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


for n, (_, _, subject, question, addition, answer, explanation, *choices) in enumerate(zip(*values), 1):
    row = dict(n=n, subject=int(subject) - 1, topic=topics[n - 1], text=plain(question),
               choices=list(map(plain, choices)), answer=int(answer) - 1, explanation=plain(explanation))
    if not row["text"] or not row["explanation"] or not all(row["choices"]) or not 0 <= row["answer"] < 4:
        raise ValueError(f"Invalid content in question {n}")
    extra = fragment(addition)
    pictures = extra.find_all("img")
    rendered = []
    for i, img in enumerate(pictures, 1):
        data = img.get("src", "")
        if not data.startswith("data:image/png;base64,"):
            raise ValueError(f"Unsupported image in question {n}")
        payload = base64.b64decode(data.split(",", 1)[1], validate=True)
        with Image.open(BytesIO(payload)) as picture:
            if picture.format != "PNG":
                raise ValueError(f"Invalid PNG in question {n}")
            picture.verify()
        name = f"{bank_id}-{n}-{i}.png"
        images[name] = payload
        rendered.append(f'<img src="img/{name}" alt="문항 {n} 그림 {i}">')
        img.decompose()
    if extra.find(["table", "object", "iframe"]):
        raise ValueError(f"Unsupported supplement in question {n}")
    supplement = plain(str(extra))
    if supplement:
        rendered.insert(0, "<pre>" + escape(supplement) + "</pre>")
    if rendered:
        row["visual"] = "".join(rendered)
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
