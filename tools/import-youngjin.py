"""Convert a saved Youngjin CBT round and its topic list into a local question bank."""
import argparse
import base64
from collections import Counter
from html import escape
from io import BytesIO
import json
from pathlib import Path
import re

from bs4 import BeautifulSoup
from PIL import Image

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("html", type=Path)
parser.add_argument("topics", type=Path)
args = parser.parse_args()
page = BeautifulSoup(args.html.read_bytes(), "html.parser", from_encoding="utf-8")
topics = args.topics.read_text(encoding="utf-8").split()
fields = ["question_date", "question_no", "subject_no", "question", "addition", "answer",
          "explanation", *(f"example{i}" for i in range(1, 5))]
values = [[field.get("value", field.get_text()) for field in page.select(f'[name="{key}[]"]')]
          for key in fields]
if len(topics) != 60 or any(len(column) != 60 for column in values):
    parser.error("Expected 60 rows and 60 topic keys")
dates, source_ids, subjects = values[:3]
if len(set(dates)) != 1 or len(set(source_ids)) != 60 or Counter(subjects) != {"1": 20, "2": 20, "3": 20}:
    parser.error("Expected one round with 60 unique IDs and 20 questions per subject")
match = re.fullmatch(r"(20\d{2})-(\d{2})-01", dates[0])
if not match:
    parser.error(f"Unexpected round identifier: {dates[0]}")
year, round_number = match.groups()
bank_id = f"ref-youngjin-{year}-{round_number}"
title = f"영진닷컴 {year}년 상시 기출 {round_number}회"
bank = dict(id=bank_id, title=title, source="ref", questions=[])
images = {}


def fragment(raw):
    return BeautifulSoup(raw, "html.parser")


def plain(raw):
    part = fragment(raw)
    if part.find(["img", "table", "object", "iframe"]):
        raise ValueError("Rich content in a text-only field")
    for tag in part.find_all(["br", "p", "div"]):
        if tag.name == "br":
            tag.replace_with("\n")
        else:
            tag.insert_after("\n")
    return part.get_text().strip()


def split_visual(raw, key, label):
    part = fragment(raw)
    rendered = []
    for i, img in enumerate(part.find_all("img"), 1):
        data = img.get("src", "")
        if not data.startswith("data:image/png;base64,"):
            raise ValueError(f"Unsupported image in {key}")
        payload = base64.b64decode(data.split(",", 1)[1], validate=True)
        with Image.open(BytesIO(payload)) as picture:
            if picture.format != "PNG":
                raise ValueError(f"Invalid PNG in {key}")
            picture.verify()
        name = f"{bank_id}-{key}-{i}.png"
        images[name] = payload
        rendered.append(f'<img src="img/{name}" alt="{label} 그림 {i}">')
        img.decompose()
    for table in part.find_all("table"):
        if table.find_parent("table"):
            continue
        table.attrs = {}
        for tag in table.find_all(True):
            if tag.name not in {"table", "tr", "th", "td", "span", "b", "i", "br", "div", "pre", "code"}:
                tag.unwrap()
                continue
            tag.attrs = {key: value for key, value in tag.attrs.items()
                         if key in {"colspan", "rowspan"} and isinstance(value, str) and value.isdecimal()}
        rendered.append(str(table))
        table.decompose()
    return plain(str(part)), "".join(rendered)


for n, (_, _, subject, question, addition, answer, explanation, *choices) in enumerate(zip(*values), 1):
    text, question_visual = split_visual(question, f"{n}-question", f"문항 {n}")
    supplement, addition_visual = split_visual(addition, str(n), f"문항 {n}")
    explanation, explanation_visual = split_visual(explanation, f"{n}-explanation", "해설")
    row = dict(n=n, subject=int(subject) - 1, topic=topics[n - 1], text=text or "다음 그림을 보시오.",
               choices=[], answer=int(answer) - 1, explanation=explanation or "그림 해설")
    choice_visuals = []
    for i, choice in enumerate(choices, 1):
        choice_text, choice_visual = split_visual(choice, f"{n}-choice-{i}", f"보기 {i}")
        row["choices"].append(choice_text or (f"보기 {i} 그림" if choice_visual else ""))
        choice_visuals.append(choice_visual)
    if (not text and not question_visual or not explanation and not explanation_visual
            or not all(row["choices"]) or not 0 <= row["answer"] < 4):
        raise ValueError(f"Invalid content in question {n}")
    visual = question_visual + ("<pre>" + escape(supplement) + "</pre>" if supplement else "") + addition_visual
    if visual:
        row["visual"] = visual
    if any(choice_visuals):
        row["choiceVisuals"] = choice_visuals
    if explanation_visual:
        row["explanationVisual"] = explanation_visual
    bank["questions"].append(row)

root = Path("web/data")
dest = root / f"{bank_id}.js"
if dest.exists():
    parser.error(f"Bank already exists: {dest}")
(root / "img").mkdir(parents=True, exist_ok=True)
for name, payload in images.items():
    (root / "img" / name).write_bytes(payload)
dest.write_text("addBank(" + json.dumps(bank, ensure_ascii=False, indent=2) + ");\n", encoding="utf-8")
print(f"{bank_id}: {len(bank['questions'])} questions, {len(images)} images")
