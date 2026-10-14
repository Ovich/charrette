// The repository's channels (D47: no mockup; RepoList's rows are the model): Main, the open
// plans, the open brainstorms, then the closed runs, collapsed.
import { useState } from "react";
import type { ChannelEntry, ChannelGroups, ChannelId } from "../lib/view.ts";

export function ChannelItem({ entry, selected, onSelect }: { entry: ChannelEntry; selected: boolean; onSelect: () => void }) {
  return (
    <button className="rail-row" data-component="ChannelItem" aria-current={selected ? "true" : undefined} onClick={onSelect}>
      <span className="t">{entry.title}</span>
      {entry.code && (
        <span className="code" data-component="PlanCode">
          {entry.code}
        </span>
      )}
      <span className="n" aria-label={`${entry.members} members`}>
        {entry.members}
      </span>
    </button>
  );
}

export function ClosedChannels({ entries, selected, onSelect }: { entries: ChannelEntry[]; selected: ChannelId; onSelect: (c: ChannelId) => void }) {
  const holdsSelected = entries.some((e) => e.id === selected);
  const [opened, setOpened] = useState(false);
  const open = opened || holdsSelected;
  if (!entries.length) return null;
  return (
    <div data-component="ClosedChannels">
      <button className="rail-toggle" aria-expanded={open} onClick={() => setOpened(!open)}>
        Closed <span className="n">{entries.length}</span>
      </button>
      {open && entries.map((e) => <ChannelItem key={String(e.id)} entry={e} selected={e.id === selected} onSelect={() => onSelect(e.id)} />)}
    </div>
  );
}

function Heading({ title, entries, selected, onSelect }: { title: string; entries: ChannelEntry[]; selected: ChannelId; onSelect: (c: ChannelId) => void }) {
  if (!entries.length) return null;
  return (
    <>
      <p className="label">{title}</p>
      {entries.map((e) => (
        <ChannelItem key={String(e.id)} entry={e} selected={e.id === selected} onSelect={() => onSelect(e.id)} />
      ))}
    </>
  );
}

export function ChannelRail({ groups, selected, onSelect }: { groups: ChannelGroups; selected: ChannelId; onSelect: (c: ChannelId) => void }) {
  return (
    <nav className="rail channels" data-component="ChannelRail" aria-label="Channels">
      <ChannelItem entry={groups.main} selected={selected === "main"} onSelect={() => onSelect("main")} />
      <Heading title="Plans" entries={groups.plans} selected={selected} onSelect={onSelect} />
      <Heading title="Brainstorms" entries={groups.brainstorms} selected={selected} onSelect={onSelect} />
      <ClosedChannels entries={groups.closed} selected={selected} onSelect={onSelect} />
    </nav>
  );
}
