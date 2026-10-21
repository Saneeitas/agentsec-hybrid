#!/usr/bin/env python3
import argparse
import asyncio
import json
from pathlib import Path

from scanner.evaluation.export import export_results
from scanner.evaluation.harness import evaluate_study, load_corpus


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the closed M7 controlled evaluation")
    parser.add_argument("--phase", choices=["pilot", "final"], required=True)
    parser.add_argument("--study-id", required=True)
    parser.add_argument("--repetitions", type=int, default=3)
    parser.add_argument("--corpus", type=Path, default=Path("research/datasets/evaluation-corpus-v1.json"))
    parser.add_argument("--protocol", type=Path, default=Path("research/protocols/m7-evaluation-protocol-v1.md"))
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    corpus = load_corpus(args.corpus)
    result = asyncio.run(evaluate_study(corpus, args.study_id, args.repetitions, pilot=args.phase == "pilot"))
    hashes = export_results(result, args.output, args.corpus, args.protocol)
    print(json.dumps({"studyId": args.study_id, "phase": args.phase, "runs": len(result["runs"]), "artifactHashes": hashes}, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
