import React from 'react';

interface MarkdownRendererProps {
  content: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  if (!content) return null;

  const lines = content.split('\n');

  const renderFormattedText = (text: string) => {
    const parts = text.split(/(\*[^*]+\*|`[^`]+`)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={idx} style={{ color: 'var(--text-primary, #f8fafc)', fontWeight: 600 }}>
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code
            key={idx}
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              padding: '2px 6px',
              borderRadius: '4px',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '0.88em',
              color: '#38bdf8',
            }}
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      return part;
    });
  };

  return (
    <div className="rendered-markdown" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {lines.map((line, lineIdx) => {
        const trimmed = line.trim();

        if (!trimmed) {
          return <div key={lineIdx} style={{ height: '4px' }} />;
        }

        if (trimmed.startsWith('### ')) {
          return (
            <h4
              key={lineIdx}
              style={{
                fontSize: '1.02rem',
                fontWeight: 700,
                color: 'var(--cf-orange, #f38020)',
                margin: '4px 0 2px 0',
              }}
            >
              {renderFormattedText(trimmed.slice(4))}
            </h4>
          );
        }

        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          return (
            <div
              key={lineIdx}
              style={{
                display: 'flex',
                gap: '8px',
                paddingLeft: '4px',
                lineHeight: 1.55,
              }}
            >
              <span style={{ color: 'var(--cf-orange, #f38020)', fontWeight: 'bold' }}>•</span>
              <div style={{ flex: 1 }}>{renderFormattedText(trimmed.slice(2))}</div>
            </div>
          );
        }

        const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
        if (numMatch) {
          return (
            <div
              key={lineIdx}
              style={{
                display: 'flex',
                gap: '8px',
                paddingLeft: '4px',
                lineHeight: 1.55,
              }}
            >
              <span style={{ color: '#38bdf8', fontWeight: 600, minWidth: '18px' }}>{numMatch[1]}.</span>
              <div style={{ flex: 1 }}>{renderFormattedText(numMatch[2])}</div>
            </div>
          );
        }

        return (
          <p key={lineIdx} style={{ margin: 0, lineHeight: 1.6 }}>
            {renderFormattedText(line)}
          </p>
        );
      })}
    </div>
  );
};
