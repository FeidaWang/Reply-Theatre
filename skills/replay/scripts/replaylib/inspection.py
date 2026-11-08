"""Bounded summaries and selected diffs for CLI and MCP."""
import ntpath
import posixpath

from .history import HistoryError


def display_name(path):
    if posixpath.isabs(path) or ntpath.splitdrive(path)[0] or ntpath.isabs(path):
        return ntpath.basename(path)
    return path


def inspect_replay(data, turn_number, start_step, step_number):
    turns = data["turns"]
    if turn_number < 1 or turn_number > max(1, len(turns)):
        raise HistoryError(f"Turn must be between 1 and {len(turns)}." if turns else "The record has no replayable turns.")
    if start_step < 1:
        raise HistoryError("Start step must be at least 1.")

    turn = turns[turn_number - 1] if turns else None
    steps = turn["steps"] if turn else []
    result = {
        "turn": turn_number if turn else None,
        "turns": len(turns),
        "turnStatus": turn["status"] if turn else None,
        "stepCount": len(steps),
        "truncatedHistory": data["source"]["truncated"],
    }

    def summarize(step, number):
        entry = {
            "step": number,
            "file": display_name(step["displayPath"]),
            "kind": step["kind"],
            "status": step["status"],
            "applied": step["applied"],
            "added": step["added"],
            "removed": step["removed"],
        }
        evidence = step.get("provenance", {})
        if evidence.get("type") == "snapshot":
            entry["observed"] = {
                key: evidence[key] for key in ("toolStatus", "attribution", "ordering", "limited")
            }
        return entry

    if step_number is not None:
        if not 1 <= step_number <= len(steps):
            raise HistoryError(f"Step must be between 1 and {len(steps)}." if steps else "This turn has no edits.")
        step = steps[step_number - 1]
        diff_limit = 8000
        result["edit"] = {
            **summarize(step, step_number),
            "diff": step["diff"][:diff_limit],
            "diffTruncated": len(step["diff"]) > diff_limit,
        }
    else:
        if start_step > max(1, len(steps)):
            raise HistoryError(f"Start step exceeds the {len(steps)} recorded edits.")
        end = start_step + 11
        result["edits"] = [summarize(step, number) for number, step in enumerate(steps[start_step - 1:end], start_step)]
        result["nextStep"] = end + 1 if end < len(steps) else None
    return result
