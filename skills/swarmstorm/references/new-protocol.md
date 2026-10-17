# A new protocol, or a new template

## A protocol

A protocol is a new way for seats to work: its own phases. It usually starts as a custom
protocol in one run's strategy; it is written here once the person wants it for every run of its
kind. It is a folder,
`references/<protocol>/`, added as a row to the `swarmstorm` skill's protocol table, and holds:

- **`protocol.md`**: what goes in and comes out, in one paragraph; the strategy fields it adds
  to the shared ones, each with its recommended value; the phase table (phase, who, may, may
  not, the orchestrator after); the rules that hold in every phase; the phase messages, one per
  phase, each saying every seat's part; the orchestrator's duties the protocol adds; its templates, a table of name, when and file.
- **`documents.md`**: its record (its own template, or another skill's board it writes) and, when the topic will run more than once, its dossier: each a skeleton to copy, its sections the protocol's, and who reads which.
- **`seats.md`**, when it has default seats: per seat its function, effort, what it owns, what
  it answers in the brief, what it never reads; a seat's parts are what the phase messages ask
  of it.
- **`templates/`**, when it has templates.

A protocol names nothing from the project or the run it was first used in: what the first use
taught is written as a rule of the protocol, or into a template.

## A template

A template is one use of a protocol, kept because it worked and will run again:
`references/<protocol>/templates/<template>.md`, added to the protocol's template table. It
fills the protocol's inputs and never changes its phases or its rules. It holds:

- **When**: the kind of work it is for, and what the person must hand over.
- **The strategy**: every field the template fixes, its value and why; the fields left to the
  ask.
- **The seats**: each default seat renamed and given a persona for this kind of work, and any
  seat added, with its persona, effort and the phases it acts in.
- **The interview**: the questions to ask the person before the first run, in order.
- **The documents**: the sections it adds inside the protocol's dossier (an input, a seat), never new ones.
- **The output**: its skeleton, slots, length, tone and altitude.
- **What the orchestrator watches**: the failures this kind of work is prone to.

A template names no person, organisation or project: the person's facts, readers and
preferences go into the dossier, never the template. Make one from a run the person approved,
its configuration kept and everything particular to that run (a one-off input, an example
written for that reader) left out.
