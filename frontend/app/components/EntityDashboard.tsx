"use client";

import { Person } from "../lib/api";

type Props = {
  persons: Person[];
  selectedPerson: Person | null;
  onSelectPerson: (p: Person) => void;
};

function Tag({ text, color = "indigo" }: { text: string; color?: string }) {
  const colors: Record<string, string> = {
    indigo: "bg-indigo-500/20 text-indigo-300",
    green: "bg-emerald-500/20 text-emerald-300",
    amber: "bg-amber-500/20 text-amber-300",
    purple: "bg-purple-500/20 text-purple-300",
  };
  return (
    <span className={`inline-block text-xs px-2 py-0.5 rounded ${colors[color]}`}>
      {text}
    </span>
  );
}

function PersonCard({
  person,
  isSelected,
  onClick,
}: {
  person: Person;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`fade-in p-4 rounded-xl border cursor-pointer transition-all ${
        isSelected
          ? "border-[#6366f1] bg-[#6366f1]/10"
          : "border-[#2a2a3e] bg-[#12121a] hover:border-[#3a3a4e]"
      }`}
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-[#6366f1]/20 flex items-center justify-center text-lg">
          {person.name[0]}
        </div>
        <div>
          <h3 className="font-medium text-sm">{person.name}</h3>
          <p className="text-xs text-[#8888a0]">{person.source_type}</p>
        </div>
      </div>

      {person.bio && (
        <p className="text-xs text-[#8888a0] mb-3 line-clamp-2">
          {person.bio}
        </p>
      )}

      <div className="space-y-2">
        {person.interests.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {person.interests.slice(0, 4).map((i) => (
              <Tag key={i} text={i} color="indigo" />
            ))}
            {person.interests.length > 4 && (
              <span className="text-xs text-[#555]">
                +{person.interests.length - 4}
              </span>
            )}
          </div>
        )}
        {person.skills.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {person.skills.slice(0, 3).map((s) => (
              <Tag key={s} text={s} color="green" />
            ))}
            {person.skills.length > 3 && (
              <span className="text-xs text-[#555]">
                +{person.skills.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function EntityDashboard({
  persons,
  selectedPerson,
  onSelectPerson,
}: Props) {
  const selected = selectedPerson
    ? persons.find((p) => p.person_id === selectedPerson.person_id)
    : null;

  return (
    <div className="h-full flex">
      {/* Person list */}
      <div className="w-[300px] border-r border-[#2a2a3e] overflow-y-auto p-4 space-y-3">
        <h2 className="text-sm font-medium text-[#8888a0] uppercase tracking-wide mb-2">
          Participants ({persons.length})
        </h2>
        {persons.map((p) => (
          <PersonCard
            key={p.person_id}
            person={p}
            isSelected={selectedPerson?.person_id === p.person_id}
            onClick={() => onSelectPerson(p)}
          />
        ))}
      </div>

      {/* Detail view */}
      <div className="flex-1 overflow-y-auto p-8">
        {selected ? (
          <div className="max-w-2xl mx-auto space-y-6 fade-in">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-[#6366f1]/20 flex items-center justify-center text-2xl">
                {selected.name[0]}
              </div>
              <div>
                <h1 className="text-2xl font-light">{selected.name}</h1>
                <p className="text-sm text-[#8888a0]">
                  Source: {selected.source_type}
                </p>
              </div>
            </div>

            {selected.bio && (
              <p className="text-sm text-[#8888a0] leading-relaxed">
                {selected.bio}
              </p>
            )}

            <Section title="Interests" items={selected.interests} color="indigo" />
            <Section title="Skills" items={selected.skills} color="green" />
            <Section title="Traits" items={selected.traits} color="purple" />
            <Section title="Goals" items={selected.goals} color="amber" />
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-[#8888a0]">
            <p>Select a person to view their knowledge profile</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  items,
  color,
}: {
  title: string;
  items: string[];
  color: string;
}) {
  if (!items.length) return null;
  return (
    <div>
      <h3 className="text-xs text-[#555] uppercase tracking-wide mb-2">
        {title}
      </h3>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <Tag key={item} text={item} color={color} />
        ))}
      </div>
    </div>
  );
}
