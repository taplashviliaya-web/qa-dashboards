"use client";

import type { JiraEpicSummary } from "@/types/jira";
import { StatusBadge, jiraStatusColor } from "./StatusBadge";

type Props = {
  epics: JiraEpicSummary[];
  selectedKey?: string;
  onSelect: (key: string) => void;
  emptyMessage?: string;
};

export function EpicsTable({
  epics,
  selectedKey,
  onSelect,
  emptyMessage = "No active Player Version Epics found."
}: Props) {
  if (epics.length === 0) {
    return <p className="muted">{emptyMessage}</p>;
  }

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Epic title</th>
            <th>Status</th>
            <th>Jira link</th>
          </tr>
        </thead>
        <tbody>
          {epics.map((epic) => {
            const isSelected = epic.key === selectedKey;
            return (
              <tr
                key={epic.key}
                className={`clickable ${isSelected ? "selected" : ""}`}
                onClick={() => onSelect(epic.key)}
              >
                <td>{epic.title}</td>
                <td>
                  <StatusBadge color={jiraStatusColor(epic.status)} label={epic.status} />
                </td>
                <td>
                  <a
                    href={epic.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {epic.key}
                  </a>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
