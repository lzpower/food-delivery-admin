// Adapted from JolyUI Vercel Tabs (MIT), https://jolyui.dev/r/vercel-tabs
// License: /licenses/jolyui-LICENSE.txt. Controlled state, resize and reduced-motion support added.
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
export type TabData = { value: string; label: string; icon?: ReactNode; content: ReactNode };
export function VercelTabs({ tabs, value, onValueChange }: { tabs: TabData[]; value: string; onValueChange: (value: string) => void }) {
  const list = useRef<HTMLDivElement>(null), buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const [hover, setHover] = useState<number | null>(null), [indicator, setIndicator] = useState({ left: 0, width: 0 }), [highlight, setHighlight] = useState({ left: 0, width: 0 });
  const active = tabs.findIndex(t => t.value === value);
  useEffect(() => {
    function update() {
      const el = buttons.current[active]; if (el) setIndicator({ left: el.offsetLeft, width: el.offsetWidth });
      const hovered = hover === null ? null : buttons.current[hover]; if (hovered) setHighlight({ left: hovered.offsetLeft, width: hovered.offsetWidth });
    }
    update(); const observer = new ResizeObserver(update);
    if (list.current) observer.observe(list.current);
    buttons.current.forEach(b => { if (b) observer.observe(b); });
    return () => observer.disconnect();
  }, [active, hover]);
  return <Tabs.Root value={value} onValueChange={onValueChange} className="joly-tabs">
    <div className="joly-tabs-scroll"><Tabs.List aria-label="Các mục quản trị" className="joly-tabs-list" ref={list} onMouseLeave={() => setHover(null)}>
      <span aria-hidden="true" className="joly-tabs-hover" style={{ ...highlight, opacity: hover === null ? 0 : 1 }} />
      <span aria-hidden="true" className="joly-tabs-indicator" style={indicator} />
      {tabs.map((t, i) => <Tabs.Trigger ref={el => { buttons.current[i] = el; }} value={t.value} key={t.value} className="joly-tab" onMouseEnter={() => setHover(i)}>{t.icon}{t.label}</Tabs.Trigger>)}
    </Tabs.List></div>
    {tabs.map(t => <Tabs.Content key={t.value} value={t.value} className="joly-tab-panel">{t.content}</Tabs.Content>)}
  </Tabs.Root>;
}
