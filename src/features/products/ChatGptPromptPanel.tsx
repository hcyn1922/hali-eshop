import React, { useEffect, useRef, useState } from 'react';
import { Copy, ExternalLink, MessageSquareText, X } from 'lucide-react';
import { buildChatGptPrompt, CHATGPT_DEFAULTS, type ChatGptPromptOptions } from '../../lib/chatgptPrompt';
import { Button, Input, Select, Textarea, useToast } from '../../ui';

const CHATGPT_URL = 'https://chatgpt.com/';

/** Free route: fill in the master prompt, copy it and open ChatGPT. Staff upload the result with "Add photo". */
export function ChatGptPromptPanel({ productName, onClose }: { productName?: string; onClose: () => void }) {
  const toast = useToast();
  const [options, setOptions] = useState<ChatGptPromptOptions>({ ...CHATGPT_DEFAULTS, productName: productName || '' });
  const [prompt, setPrompt] = useState(() => buildChatGptPrompt({ ...CHATGPT_DEFAULTS, productName: productName || '' }));
  const [edited, setEdited] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);

  // Rebuild the prompt when the options change, unless staff have edited the text by hand
  useEffect(() => {
    if (!edited) setPrompt(buildChatGptPrompt(options));
  }, [options, edited]);

  const set = (k: keyof ChatGptPromptOptions) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setOptions(o => ({ ...o, [k]: e.target.value }));

  const copy = async (): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(prompt);
      return true;
    } catch {
      // Clipboard can be blocked (older phones, non-HTTPS): select the text so it can be copied by hand
      textRef.current?.focus();
      textRef.current?.select();
      try {
        return document.execCommand('copy');
      } catch {
        return false;
      }
    }
  };

  const copyAndOpen = async () => {
    // Copy first (needs the page to keep focus), then open ChatGPT in a new tab
    const ok = await copy();
    window.open(CHATGPT_URL, '_blank', 'noopener,noreferrer');
    toast(ok ? 'Prompt copied. Paste it into ChatGPT and attach the product photo.' : 'Select the prompt and copy it by hand.', ok ? 'success' : 'error');
  };

  return (
    <div
      className="mt-4 rounded-xl border border-line bg-subtle p-4"
      onKeyDown={e => {
        if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') e.preventDefault();
      }}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <MessageSquareText className="h-5 w-5 text-fg-3" />
          <div>
            <p className="text-sm font-semibold text-fg">Make photos in ChatGPT (free)</p>
            <p className="text-xs text-fg-3">Uses your own ChatGPT account and its daily image limits</p>
          </div>
        </div>
        <Button variant="tertiary" size="sm" iconOnly icon={<X className="h-4 w-4" />} aria-label="Close ChatGPT prompt" onClick={onClose} />
      </div>

      <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm text-fg-2">
        <li>Click <strong>Copy and open ChatGPT</strong>, then paste the prompt there.</li>
        <li>Attach the product photo first, and a style reference photo second if you have one.</li>
        <li>Check ChatGPT's description, especially the wording on the label, then reply <strong>Proceed</strong>.</li>
        <li>Download the photos and add them here with <strong>Add photo</strong>.</li>
      </ol>

      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Product name" value={options.productName} onChange={set('productName')} containerClassName="sm:col-span-2" />
        <Input label="Background" value={options.background} onChange={set('background')} />
        <Input label="Lighting" value={options.lighting} onChange={set('lighting')} />
        <Input label="Product size in frame" value={options.productFill} onChange={set('productFill')} />
        <Select label="Layout" value={options.layout} onChange={set('layout')}>
          <option value="grid">Four photos in one 2×2 grid</option>
          <option value="single">Four separate photos</option>
        </Select>
      </div>

      <Textarea
        ref={textRef}
        label="Prompt"
        rows={8}
        value={prompt}
        onChange={e => {
          setPrompt(e.target.value);
          setEdited(true);
        }}
        hint={
          edited ? (
            <button type="button" className="cursor-pointer underline" onClick={() => setEdited(false)}>
              Undo my edits and rebuild from the fields above
            </button>
          ) : (
            'You can edit the text before copying.'
          )
        }
        containerClassName="mt-3"
        className="font-mono text-xs"
      />

      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <Button variant="secondary" icon={<Copy className="h-4 w-4" />} onClick={async () => ((await copy()) ? toast('Prompt copied.') : toast('Select the prompt and copy it by hand.', 'error'))}>
          Copy prompt
        </Button>
        <Button variant="primary" icon={<ExternalLink className="h-4 w-4" />} onClick={copyAndOpen}>
          Copy and open ChatGPT
        </Button>
      </div>
    </div>
  );
}
