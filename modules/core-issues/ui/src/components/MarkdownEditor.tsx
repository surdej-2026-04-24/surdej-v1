import { useState, useRef, useCallback } from 'react';

interface MarkdownEditorProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    minRows?: number;
    users?: Array<{ username: string; displayName: string }>;
}

/**
 * Split-pane Markdown editor with live preview and @mention autocomplete.
 */
export function MarkdownEditor({
    value,
    onChange,
    placeholder = 'Write in Markdown…',
    minRows = 8,
    users = [],
}: MarkdownEditorProps) {
    const [showMentions, setShowMentions] = useState(false);
    const [mentionFilter, setMentionFilter] = useState('');
    const [mentionPos, setMentionPos] = useState({ top: 0, left: 0 });
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const handleInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const text = e.target.value;
        onChange(text);

        // Check for @mention trigger
        const pos = e.target.selectionStart;
        const before = text.substring(0, pos);
        const mentionMatch = before.match(/@([a-zA-Z0-9_-]*)$/);

        if (mentionMatch && users.length > 0) {
            setMentionFilter(mentionMatch[1].toLowerCase());
            setShowMentions(true);
            // Position dropdown near cursor
            setMentionPos({ top: 100, left: 20 });
        } else {
            setShowMentions(false);
        }
    }, [onChange, users]);

    const insertMention = useCallback((username: string) => {
        if (!textareaRef.current) return;
        const pos = textareaRef.current.selectionStart;
        const before = value.substring(0, pos);
        const after = value.substring(pos);
        const mentionStart = before.lastIndexOf('@');
        const newValue = before.substring(0, mentionStart) + `@${username} ` + after;
        onChange(newValue);
        setShowMentions(false);
        textareaRef.current.focus();
    }, [value, onChange]);

    const filteredUsers = users.filter(u =>
        u.username.toLowerCase().includes(mentionFilter) ||
        u.displayName.toLowerCase().includes(mentionFilter),
    );

    // Simple Markdown → HTML converter
    const renderPreview = (md: string): string => {
        if (!md) return '<p style="color: #9ca3af; font-style: italic;">Preview vises her…</p>';
        return md
            // Headers
            .replace(/^### (.+)$/gm, '<h3>$1</h3>')
            .replace(/^## (.+)$/gm, '<h2>$1</h2>')
            .replace(/^# (.+)$/gm, '<h1>$1</h1>')
            // Bold & italic
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            // Code
            .replace(/`(.+?)`/g, '<code style="background:#f3f4f6;padding:2px 4px;border-radius:3px;font-size:0.9em;">$1</code>')
            // Links
            .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" style="color:#3b82f6;">$1</a>')
            // @Mentions
            .replace(/@([a-zA-Z0-9_-]+)/g, '<span style="color:#3b82f6;font-weight:600;">@$1</span>')
            // Line breaks
            .replace(/\n/g, '<br/>');
    };

    return (
        <div style={{ position: 'relative' }}>
            <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1,
                border: '1px solid var(--border, #d1d5db)', borderRadius: 8, overflow: 'hidden',
                background: 'var(--border, #e5e7eb)',
            }}>
                {/* Editor */}
                <div style={{ position: 'relative' }}>
                    <div style={{
                        fontSize: 10, fontWeight: 600, padding: '4px 10px',
                        background: 'var(--muted, #f3f4f6)', color: 'var(--muted-foreground)',
                        borderBottom: '1px solid var(--border, #e5e7eb)',
                    }}>
                        ✏️ MARKDOWN
                    </div>
                    <textarea
                        ref={textareaRef}
                        value={value}
                        onChange={handleInput}
                        placeholder={placeholder}
                        rows={minRows}
                        style={{
                            width: '100%', padding: 12, border: 'none', fontSize: 13,
                            fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                            resize: 'vertical', outline: 'none', boxSizing: 'border-box',
                            background: 'var(--background, #fff)',
                        }}
                    />
                </div>

                {/* Preview */}
                <div>
                    <div style={{
                        fontSize: 10, fontWeight: 600, padding: '4px 10px',
                        background: 'var(--muted, #f3f4f6)', color: 'var(--muted-foreground)',
                        borderBottom: '1px solid var(--border, #e5e7eb)',
                    }}>
                        👁️ PREVIEW
                    </div>
                    <div
                        style={{
                            padding: 12, fontSize: 13, lineHeight: 1.6, minHeight: `${minRows * 1.5}em`,
                            background: 'var(--background, #fff)',
                        }}
                        dangerouslySetInnerHTML={{ __html: renderPreview(value) }}
                    />
                </div>
            </div>

            {/* @Mention dropdown */}
            {showMentions && filteredUsers.length > 0 && (
                <div style={{
                    position: 'absolute', top: mentionPos.top, left: mentionPos.left,
                    background: 'var(--card, #fff)', border: '1px solid var(--border, #d1d5db)',
                    borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 10,
                    maxHeight: 160, overflow: 'auto', minWidth: 200,
                }}>
                    {filteredUsers.map(u => (
                        <button
                            key={u.username}
                            onClick={() => insertMention(u.username)}
                            style={{
                                display: 'block', width: '100%', padding: '8px 12px',
                                border: 'none', background: 'transparent', textAlign: 'left',
                                cursor: 'pointer', fontSize: 12,
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--muted, #f3f4f6)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                            <strong>@{u.username}</strong>
                            <span style={{ color: 'var(--muted-foreground)', marginLeft: 8 }}>{u.displayName}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
