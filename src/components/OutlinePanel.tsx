import type { OutlineHeading } from '../lib/outline';

interface Props {
  headings: OutlineHeading[];
  onSelect: (offset: number) => void;
  onClose: () => void;
}

export default function OutlinePanel({ headings, onSelect, onClose }: Props) {
  return (
    <aside className="outline-panel" aria-label="Document outline">
      <div className="outline-header">
        <strong>Document outline</strong>
        <button className="outline-close" type="button" onClick={onClose} aria-label="Close outline">×</button>
      </div>
      <nav className="outline-list" aria-label="Markdown headings">
        {headings.length === 0 ? (
          <p className="outline-empty">Add Markdown headings to see the outline.</p>
        ) : headings.map((heading) => (
          <button key={heading.offset} type="button" className="outline-item"
            style={{ paddingLeft: 12 + Math.min(heading.level - 1, 5) * 14 }}
            title={'Line ' + heading.line + ': ' + heading.text}
            onClick={() => onSelect(heading.offset)}>
            <span className="outline-level" aria-hidden="true">H{heading.level}</span>
            <span className="outline-text">{heading.text}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}
