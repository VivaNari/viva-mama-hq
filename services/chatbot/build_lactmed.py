#!/usr/bin/env python3
"""
build_lactmed.py  -  Build a clean, searchable LactMed dataset in one step.

WHAT IT DOES
  1. Finds the LactMed package on NCBI's FTP (by its ID, NBK501922).
  2. Downloads it (one file) and unzips it.
  3. Parses every drug record (.nxml) into one file: lactmed.json
  4. Lets you look up any medicine by name OR brand name.

HOW TO RUN  (Python 3.8+, internet connection, no 'pip install' needed)
  python build_lactmed.py                # run once -> creates lactmed.json
  python build_lactmed.py ibuprofen      # look up a drug
  python build_lactmed.py dysport        # brand names work too

FOR YOUR APP
  After lactmed.json exists, your backend just loads it and reads
  data["drugs"][ data["aliases"].get(name, name) ].  That's the whole data layer.
"""

import csv
import io
import json
import os
import re
import sys
import tarfile
import urllib.request
import xml.etree.ElementTree as ET

BASE = "https://ftp.ncbi.nlm.nih.gov/pub/litarch/"
FILE_LIST = BASE + "file_list.csv"
ACCESSION = "NBK501922"  # LactMed's ID
OUT_JSON = "lactmed.json"


# ---------- download ----------
def find_package_path():
    print("Looking up LactMed in the index file...")
    with urllib.request.urlopen(FILE_LIST) as r:
        text = r.read().decode("utf-8", errors="replace")
    for row in csv.reader(io.StringIO(text)):
        if any(c.strip() == ACCESSION for c in row):
            for c in row:
                if c.strip().endswith(".tar.gz"):
                    print("  found:", c.strip())
                    return c.strip()
    raise SystemExit("LactMed (NBK501922) not found in index.")


def download_and_extract(path):
    print("Downloading the database (the only big download)...")
    with urllib.request.urlopen(BASE + path) as r:
        data = r.read()
    print("Unzipping...")
    folder = "lactmed_data"
    with tarfile.open(fileobj=io.BytesIO(data), mode="r:gz") as tar:
        tar.extractall(folder)
    return folder


# ---------- parsing ----------
def strip_ns(tag):
    return tag.split("}", 1)[-1] if "}" in tag else tag


def text_of(elem):
    s = "".join(elem.itertext())
    s = re.sub(r"\[\d+(?:,\s*\d+)*\]", "", s)  # remove [1] / [1,2] citation marks
    return " ".join(s.split())


def first(elem, tag):
    for e in elem.iter():
        if strip_ns(e.tag) == tag:
            return e
    return None


def parse_record(path):
    try:
        root = ET.parse(path).getroot()
    except ET.ParseError:
        return None

    # drug name (book-part-meta > title-group > title)
    name = None
    bpm = first(root, "book-part-meta")
    if bpm is not None:
        tg = first(bpm, "title-group")
        if tg is not None:
            t = first(tg, "title")
            if t is not None:
                name = text_of(t)
    if not name:
        name = os.path.splitext(os.path.basename(path))[0]

    # synonyms / brand names (keywords)
    synonyms = []
    for k in root.iter():
        if strip_ns(k.tag) == "kwd":
            v = text_of(k)
            if v and v.lower() != name.lower() and v not in synonyms:
                synonyms.append(v)

    # revised date
    revised = None
    for d in root.iter():
        if strip_ns(d.tag) == "date" and d.get("date-type") == "revised":
            y, m, dy = first(d, "year"), first(d, "month"), first(d, "day")
            parts = [x.text for x in (y, m, dy) if x is not None and x.text]
            revised = "-".join(parts) if parts else None

    # all titled sections -> {title: text}
    sections = {}
    drug_class = []
    for sec in root.iter():
        if strip_ns(sec.tag) != "sec":
            continue
        title_el = next((c for c in sec if strip_ns(c.tag) == "title"), None)
        if title_el is None:
            continue
        title = text_of(title_el)
        paras = [text_of(c) for c in sec if strip_ns(c.tag) == "p"]
        body = " ".join(p for p in paras if p).strip()
        if title == "Drug Class":
            drug_class = [p for p in paras if p]
        elif body:
            sections[title] = body

    return {
        "name": name,
        "synonyms": synonyms,
        "revised": revised,
        "summary": sections.get("Summary of Use during Lactation"),
        "drug_class": drug_class,
        "sections": sections,
    }


# ---------- build ----------
def build():
    folder = download_and_extract(find_package_path())
    print("Reading drug records...")
    drugs, aliases = {}, {}
    for dp, _, files in os.walk(folder):
        for fn in files:
            if not fn.endswith(".nxml"):
                continue
            rec = parse_record(os.path.join(dp, fn))
            if not rec or not rec["name"]:
                continue
            key = rec["name"].lower()
            drugs[key] = rec
            for syn in rec["synonyms"]:
                aliases.setdefault(syn.lower(), key)  # brand/synonym -> drug

    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump({"drugs": drugs, "aliases": aliases}, f, ensure_ascii=False, indent=2)
    print(
        f"\nDone. {len(drugs)} medicines saved to {OUT_JSON} "
        f"({len(aliases)} brand/alias names indexed)."
    )
    print("Try:  python build_lactmed.py ibuprofen")


# ---------- lookup ----------
def lookup(query):
    if not os.path.exists(OUT_JSON):
        print("Run 'python build_lactmed.py' first to create lactmed.json.")
        return
    with open(OUT_JSON, encoding="utf-8") as f:
        data = json.load(f)
    drugs, aliases = data["drugs"], data["aliases"]

    q = query.lower().strip()
    key = q if q in drugs else aliases.get(q)
    if not key:
        partial = [k for k in drugs if q in k] + [aliases[a] for a in aliases if q in a]
        partial = sorted(set(partial))
        if not partial:
            print(f"No record for '{query}'.")
            return
        if len(partial) > 1:
            names = [drugs[k]["name"] for k in partial][:15]
            print("Did you mean:", ", ".join(names))
        key = partial[0]

    d = drugs[key]
    print("\n=== " + d["name"] + " ===")
    if d["revised"]:
        print("Last revised:", d["revised"])
    print(
        "\nSummary of Use during Lactation:\n"
        + (d["summary"] or "(no summary section in this record)")
    )
    print("\n[Source: LactMed (NCBI/NIH). Not medical advice - consult a doctor or pharmacist.]")


if __name__ == "__main__":
    if len(sys.argv) > 1:
        lookup(" ".join(sys.argv[1:]))
    else:
        build()
