"""Convert and cross-check the two local 2024 CBT PDF sets."""
import argparse
import html
import json
from pathlib import Path
import re
import sys

import pymupdf

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "web" / "data"
ITEM = r"(?m)^[ \t]*(\d{1,2})\.[ \t]+(?=\S)"
SOLUTION = re.compile(
    r"(?m)^[ \t]*(\d{1,2})\.[ \t]*\n[ \t]*정답(?: 및 풀이)?[ \t]*:[ \t]*([1-4])[ \t]*$"
)
SUBJECT_HEADER = re.compile(r"(?m)^[ \t]*\uf000?[ \t]*제([1-3])과목[^\n]*$")
CHOICE = re.compile(r"(?m)^[ \t]*([①②③④])[ \t]*")
TOPICS = (
    "windows hardware software network security multimedia trend".split(),
    "xl-basic xl-func xl-chart xl-data xl-analysis xl-macro xl-print".split(),
    "db-theory db-table db-query db-form db-report db-macro".split(),
)
TOPIC_NUMBERS = {
    1: (
        "4 1 6 4 2 2 6 5 6 2 1 6 7 4 5 1 3 4 3 4",
        "1 1 6 1 6 1 7 4 4 2 1 3 4 6 4 1 2 6 2 1",
        "2 1 3 4 3 3 4 5 5 3 6 3 5 4 2 4 6 2 6 2",
    ),
    2: (
        "4 1 1 4 7 2 2 2 2 4 1 2 3 5 5 6 6 3 3 3",
        "1 5 1 2 6 3 2 2 4 3 6 5 5 1 7 1 2 2 1 3",
        "4 3 2 3 5 1 2 1 5 2 2 4 4 2 5 1 4 1 2 4",
    ),
}
# Page and embedded image positions verified against the source page.
FIGURES = {
    1: {21: (3, 0), 26: (3, 1), 30: (3, 2), 33: (4, 0), 35: (4, 1),
        37: (4, 2), 39: (4, 3), 41: (5, 0), 48: (5, 1, 2)},
    2: {21: (2, 0), 25: (3, 0, 1), 27: (3, 2), 30: (3, 3, 4, 5, 6),
        32: (4, 0), 33: (4, 1), 34: (4, 2), 37: (4, 3), 38: (4, 4),
        49: (5, 0, 1), 53: (6, 0), 55: (6, 1, 2)},
}


def extract(document):
    return "\n".join(page.get_text().replace("\x01", " ") for page in document)


def strip_edges(text):
    return "\n".join(line.rstrip() for line in text.strip().splitlines())


def parse_solutions(pdf, round_number):
    source = extract(pdf)
    table_source, solutions = source.split("제1과목", 1)
    table_lines = re.findall(r"(?m)^[ \t]*(\d{1,2}번|[1-4])[ \t]*$", table_source)
    if len(table_lines) != 120:
        raise ValueError("Expected 60 numbered answer table entries")
    table_answers = []
    for first in range(1, 61, 20):
        offset = 2 * (first - 1)
        if table_lines[offset:offset + 20] != [f"{n}번" for n in range(first, first + 20)]:
            raise ValueError(f"Answer table numbers {first}–{first + 19} are out of order")
        table_answers.extend(int(answer) for answer in table_lines[offset + 20:offset + 40])

    markers = list(SOLUTION.finditer(solutions))
    if len(markers) != 60:
        raise ValueError(f"Expected 60 solution blocks, got {len(markers)}")
    explanations = []
    for n, marker in enumerate(markers, 1):
        printed_number, answer = map(int, marker.groups())
        expected_number = 21 if round_number == 1 and n == 34 else n
        if printed_number != expected_number:
            raise ValueError(f"Question {n}: unexpected solution number {printed_number}")
        if answer != table_answers[n - 1]:
            raise ValueError(f"Question {n}: table answer {table_answers[n - 1]} != solution answer {answer}")
        end = markers[n].start() if n < len(markers) else len(solutions)
        explanation = strip_edges(SUBJECT_HEADER.sub("", solutions[marker.end():end]))
        if not explanation:
            raise ValueError(f"Question {n}: empty explanation")
        explanations.append((answer - 1, explanation))
    return explanations


def render_table(lines, columns):
    rows = [lines[i:i + columns] for i in range(0, len(lines), columns)]
    if not rows or any(len(row) != columns for row in rows):
        raise ValueError("Incomplete table in question 52")
    parts = ['<table class="sheet">']
    for i, row in enumerate(rows):
        tag = "th" if i == 0 else "td"
        cells = "".join(f"<{tag}>{html.escape(cell)}</{tag}>" for cell in row)
        parts.append(f"<tr>{cells}</tr>")
    return "".join(parts) + "</table>"


def parse_questions(pdf, round_number, solutions):
    sections = SUBJECT_HEADER.split(extract(pdf))
    if len(sections) != 7 or sections[1::2] != ["1", "2", "3"]:
        raise ValueError("Expected three subject headings in order")
    questions = []
    for subject, section in enumerate(sections[2::2]):
        topics = TOPIC_NUMBERS[round_number][subject].split()
        items = re.split(ITEM, section)
        expected = list(range(subject * 20 + 1, subject * 20 + 21))
        if list(map(int, items[1::2])) != expected:
            raise ValueError(f"Subject {subject + 1}: invalid question numbering")
        for n, body in zip(expected, items[2::2], strict=True):
            parts = CHOICE.split(body)
            if parts[1::2] != list("①②③④"):
                raise ValueError(f"Question {n}: expected four numbered choices")
            topic_index = int(topics[(n - 1) % 20]) - 1
            text = strip_edges(parts[0])
            choices = [strip_edges(choice) for choice in parts[2::2]]
            if not text or not all(choices):
                raise ValueError(f"Question {n}: empty question or choice")
            answer, explanation = solutions[n - 1]
            if round_number == 1 and n == 35:
                choices[2] = choices[2].replace("□\n3", "□3")
            questions.append(dict(n=n, subject=subject, topic=TOPICS[subject][topic_index],
                                  text=text, choices=choices, answer=answer, explanation=explanation))
    if round_number == 1:
        question = questions[51]
        question["text"], table_source = question["text"].split("\n<STUDENT> 테이블\n", 1)
        last_choice = questions[53]["choices"][3]
        questions[53]["choices"][3], result = last_choice.split("\n<쿼리 결과>\n", 1)
        question["visual"] = (
            "<div>&lt;STUDENT&gt; 테이블</div>" + render_table(table_source.splitlines(), 4)
            + "<div>&lt;쿼리 결과&gt;</div>" + render_table(result.splitlines(), 2)
        )
    return questions


def question_images(document, bank_id, round_number, questions):
    images = {}
    for n, (page_number, *positions) in FIGURES[round_number].items():
        page = document[page_number - 1]
        boxes = page.get_image_info()
        rects = [pymupdf.Rect(boxes[index]["bbox"]) for index in positions]
        question = questions[n - 1]
        if round_number == 2 and n == 30:
            chunks = []
            for i, rect in enumerate(rects, 1):
                path = f"img/{bank_id}-{n}-{i}.png"
                images[path] = page.get_pixmap(clip=rect, dpi=144).tobytes("png")
                chunks.append(f'<div>{i}. <img src="{path}" alt="보기 {i} 차트"></div>')
            question["visual"] = "".join(chunks)
        else:
            rect = rects[0]
            for box in rects[1:]:
                rect |= box
            path = f"img/{bank_id}-{n}.png"
            images[path] = page.get_pixmap(clip=rect, dpi=144).tobytes("png")
            question["image"] = path
    return images


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("question_pdf", type=Path)
    parser.add_argument("solution_pdf", type=Path)
    parser.add_argument("bank_id", choices=["kcci-2024-01", "kcci-2024-02"])
    parser.add_argument("title")
    args = parser.parse_args()
    output = DATA / f"{args.bank_id}.js"
    if output.exists():
        parser.error(f"Refusing to overwrite {output.name}")
    round_number = int(args.bank_id[-2:])
    with pymupdf.open(args.solution_pdf) as solution_pdf, pymupdf.open(args.question_pdf) as question_pdf:
        solutions = parse_solutions(solution_pdf, round_number)
        questions = parse_questions(question_pdf, round_number, solutions)
        images = question_images(question_pdf, args.bank_id, round_number, questions)

    private_chars = {
        q["n"]: sorted({f"U+{ord(char):04X}" for char in json.dumps(q, ensure_ascii=False)
                        if "\ue000" <= char <= "\uf8ff"})
        for q in questions
    }
    remaining = {n: chars for n, chars in private_chars.items() if chars}
    if remaining:
        raise ValueError(f"Unresolved private-use characters: {remaining}")
    bank = dict(id=args.bank_id, title=args.title, source="kcci", questions=questions)
    (DATA / "img").mkdir(parents=True, exist_ok=True)
    for path, content in images.items():
        (DATA / path).write_bytes(content)
    with output.open("x", encoding="utf-8") as file:
        file.write("addBank(" + json.dumps(bank, ensure_ascii=False, indent=2) + ");\n")
    print(f"{args.bank_id}: 60 questions, 0 answer mismatches, {len(images)} images")


if __name__ == "__main__":
    try:
        main()
    except ValueError as exc:
        sys.exit(str(exc))
