import React, {
  useCallback,
  useState,
  useMemo,
  useEffect,
  ReactNode
} from 'react';
import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight';
import { Highlight } from '@tiptap/extension-highlight';
import { TextAlign } from '@tiptap/extension-text-align';
import { Typography } from '@tiptap/extension-typography';
import { createLowlight } from 'lowlight';
import axios from 'axios';
import { API_URL } from '../config/api';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import {
  Bold,
  Italic,
  Code,
  List,
  ListOrdered,
  Quote,
  Image as ImageIcon,
  Link as LinkIcon,
  Heading1,
  Heading2,
  Heading3,
  Table as TableIcon,
  Minus,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Highlighter,
  Undo,
  Redo
} from 'lucide-react';

const lowlight = createLowlight();

interface Block {
  id: string;
  type: string;
  content?: string | Block[];
  attrs?: Record<string, any>;
}

interface TiptapEditorProps {
  content: Block[];
  onChange: (content: Block[]) => void;
  placeholder?: string;
  className?: string;
}

// Convert blocks to HTML for Tiptap
const blocksToHtml = (blocks: Block[]): string => {
  if (!blocks || !Array.isArray(blocks)) return '';

  return blocks
    .map((block) => {
      switch (block.type) {
        case 'heading': {
          const level = (block.attrs?.level as number) || 1;
          return `<h${level}>${block.content || ''}</h${level}>`;
        }
        case 'paragraph':
          return `<p>${block.content || ''}</p>`;
        case 'bulletList':
          return `<ul>${((block.content as any[]) || [])
            .map((item) => `<li>${item.content || ''}</li>`)
            .join('')}</ul>`;
        case 'orderedList':
          return `<ol>${((block.content as any[]) || [])
            .map((item) => `<li>${item.content || ''}</li>`)
            .join('')}</ol>`;
        case 'blockquote':
          return `<blockquote><p>${block.content || ''}</p></blockquote>`;
        case 'codeBlock': {
          const language = block.attrs?.language || '';
          return `<pre><code class="language-${language}">${
            block.content || ''
          }</code></pre>`;
        }
        case 'image': {
          const src = block.attrs?.src || '';
          const alt = block.attrs?.alt || '';
          return `<img src="${src}" alt="${alt}" />`;
        }
        case 'horizontalRule':
          return '<hr />';
        default:
          return `<p>${block.content || ''}</p>`;
      }
    })
    .join('');
};

// Convert Tiptap HTML to blocks
const htmlToBlocks = (html: string): Block[] => {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;

  const blocks: Block[] = [];
  let blockId = 0;

  const processNode = (node: Node): void => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element;
      const tagName = element.tagName.toLowerCase();

      switch (tagName) {
        case 'h1':
        case 'h2':
        case 'h3':
        case 'h4':
        case 'h5':
        case 'h6':
          blocks.push({
            id: `block-${++blockId}`,
            type: 'heading',
            content: element.textContent || '',
            attrs: { level: parseInt(tagName.charAt(1), 10) }
          });
          break;
        case 'p':
          if (element.textContent?.trim()) {
            blocks.push({
              id: `block-${++blockId}`,
              type: 'paragraph',
              content: element.textContent || ''
            });
          }
          break;
        case 'ul': {
          const ulItems = Array.from(element.querySelectorAll('li')).map(
            (li) => ({
              content: li.textContent || ''
            })
          );
          blocks.push({
            id: `block-${++blockId}`,
            type: 'bulletList',
            content: ulItems as any
          });
          break;
        }
        case 'ol': {
          const olItems = Array.from(element.querySelectorAll('li')).map(
            (li) => ({
              content: li.textContent || ''
            })
          );
          blocks.push({
            id: `block-${++blockId}`,
            type: 'orderedList',
            content: olItems as any
          });
          break;
        }
        case 'blockquote':
          blocks.push({
            id: `block-${++blockId}`,
            type: 'blockquote',
            content: element.textContent || ''
          });
          break;
        case 'pre': {
          const code = element.querySelector('code');
          const codeContent = code?.textContent || '';
          const language =
            code?.className?.match(/language-(\w+)/)?.[1] || '';
          blocks.push({
            id: `block-${++blockId}`,
            type: 'codeBlock',
            content: codeContent,
            attrs: { language }
          });
          break;
        }
        case 'img':
          blocks.push({
            id: `block-${++blockId}`,
            type: 'image',
            attrs: {
              src: element.getAttribute('src') || '',
              alt: element.getAttribute('alt') || ''
            }
          });
          break;
        case 'hr':
          blocks.push({
            id: `block-${++blockId}`,
            type: 'horizontalRule'
          });
          break;
        default:
          Array.from(node.childNodes).forEach(processNode);
      }
    }
  };

  Array.from(tempDiv.childNodes).forEach(processNode);
  return blocks;
};

const TiptapEditor: React.FC<TiptapEditorProps> = ({
  content,
  onChange,
  placeholder = 'Start writing...',
  className = ''
}) => {
  const { token } = useAuth();
  const { isDark } = useTheme();
  const [isUploading, setIsUploading] = useState(false);
  const [editorReady, setEditorReady] = useState(false);

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        codeBlock: false,
        link: false
      }),
      Image.configure({
        HTMLAttributes: {
          class: 'max-w-full h-auto rounded-lg shadow-sm'
        }
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-600 hover:text-blue-800 underline'
        }
      }),
      Table.configure({
        resizable: true,
        HTMLAttributes: {
          class: 'border-collapse table-auto w-full'
        }
      }),
      TableRow,
      TableHeader.configure({
        HTMLAttributes: {
          class:
            'border border-gray-300 px-4 py-2 bg-gray-50 font-semibold'
        }
      }),
      TableCell.configure({
        HTMLAttributes: {
          class: 'border border-gray-300 px-4 py-2'
        }
      }),
      CodeBlockLowlight.configure({
        lowlight,
        HTMLAttributes: {
          class:
            'bg-gray-100 dark:bg-gray-800 p-4 rounded-lg overflow-x-auto'
        }
      }),
      Highlight.configure({
        HTMLAttributes: {
          class: 'bg-yellow-200 dark:bg-yellow-600'
        }
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph']
      }),
      Typography
    ],
    []
  );

  // Upload image to backend
  const uploadImage = useCallback(
    async (file: File): Promise<string | null> => {
      try {
        setIsUploading(true);

        if (file.size > 2097152) {
          alert('Image size must be under 2MB');
          return null;
        }

        const formData = new FormData();
        formData.append('image', file);

        const response = await axios.post(
          `${API_URL}/documents/upload-image`,
          formData,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'multipart/form-data'
            }
          }
        );

        if (response.data.success) {
          return response.data.url as string;
        }
        throw new Error(response.data.message || 'Upload failed');
      } catch (error: any) {
        console.error('❌ Image upload failed:', error);
        alert(error?.response?.data?.message || 'Failed to upload image');
        return null;
      } finally {
        setIsUploading(false);
      }
    },
    [token]
  );

  const handleImageInsert = useCallback(
    async (editorInstance: Editor, file: File): Promise<void> => {
      const url = await uploadImage(file);
      if (url) {
        editorInstance.chain().focus().setImage({ src: url }).run();
      }
    },
    [uploadImage]
  );

  const editor = useEditor({
    extensions,
    content: blocksToHtml(content),
    onCreate: ({ editor }) => {
      setEditorReady(true);

      editor.view.dom.addEventListener('paste', (e: ClipboardEvent) => {
        const items = e.clipboardData?.items;
        if (!items) return;
        for (const item of Array.from(items)) {
          if (item.type.startsWith('image/')) {
            e.preventDefault();
            const file = item.getAsFile();
            if (file) {
              void handleImageInsert(editor, file);
            }
            break;
          }
        }
      });

      editor.view.dom.addEventListener('drop', (e: DragEvent) => {
        const files = e.dataTransfer?.files;
        if (!files || files.length === 0) return;
        const file = files[0];
        if (file.type.startsWith('image/')) {
          e.preventDefault();
          void handleImageInsert(editor, file);
        }
      });
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const blocks = htmlToBlocks(html);
      onChange(blocks);
    }
  });

  useEffect(() => {
    return () => {
      editor?.destroy();
    };
  }, [editor]);

  const safeEditorAction = useCallback(
    (action: (editor: Editor) => void) => {
      if (!editor || !editorReady) return;
      try {
        action(editor);
      } catch (error) {
        console.error('Editor action failed:', error);
      }
    },
    [editor, editorReady]
  );

  const safeIsActive = useCallback(
    (nameOrAttrs: string | Record<string, any>): boolean => {
      if (!editor || !editorReady) return false;
      return editor.isActive(nameOrAttrs as any);
    },
    [editor, editorReady]
  );

  // FIX: avoid `editor.can().[command]()` which Babel fails to parse
  const safeCan = useCallback(
    (command: 'undo' | 'redo'): boolean => {
      if (!editor || !editorReady) return false;
      const canObj = editor.can();
      if (command === 'undo') {
        return canObj.undo();
      }
      return canObj.redo();
    },
    [editor, editorReady]
  );

  if (!editor) {
    return (
      <div
        className={`border rounded-lg ${
          isDark
            ? 'border-gray-600 bg-gray-800'
            : 'border-gray-300 bg-white'
        } ${className} flex items-center justify-center p-8 h-64`}
      >
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
          Loading editor...
        </span>
      </div>
    );
  }

  type ToolbarButtonProps = {
    onClick: () => void;
    isActive?: boolean;
    disabled?: boolean;
    children: ReactNode;
    title: string;
  };

  const ToolbarButton: React.FC<ToolbarButtonProps> = ({
    onClick,
    isActive = false,
    disabled = false,
    children,
    title
  }) => (
    <button
      onClick={onClick}
      disabled={disabled || !editorReady}
      title={title}
      className={`p-2 rounded-md transition-colors flex items-center justify-center ${
        isActive && editorReady
          ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300'
          : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
      } ${
        disabled || !editorReady
          ? 'opacity-50 cursor-not-allowed'
          : 'hover:text-gray-900 dark:hover:text-gray-200'
      }`}
    >
      {children}
    </button>
  );

  const addLink = () => {
    const url = window.prompt('Enter URL');
    if (url) {
      safeEditorAction((ed) =>
        ed.chain().focus().setLink({ href: url }).run()
      );
    }
  };

  const addImageFromFile = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e: Event) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (file && editor) {
        void handleImageInsert(editor, file);
      }
    };
    input.click();
  };

  return (
    <div
      className={`border rounded-lg ${
        isDark
          ? 'border-gray-600 bg-gray-800'
          : 'border-gray-300 bg-white'
      } ${className}`}
    >
      {/* Toolbar */}
      <div
        className={`flex flex-wrap gap-1 p-3 border-b ${
          isDark ? 'border-gray-600' : 'border-gray-200'
        }`}
      >
        {/* Undo/Redo */}
        <ToolbarButton
          onClick={() =>
            safeEditorAction((ed) => ed.chain().focus().undo().run())
          }
          disabled={!safeCan('undo')}
          title="Undo"
        >
          <Undo className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() =>
            safeEditorAction((ed) => ed.chain().focus().redo().run())
          }
          disabled={!safeCan('redo')}
          title="Redo"
        >
          <Redo className="h-4 w-4" />
        </ToolbarButton>

        <div
          className={`mx-2 w-px h-6 ${
            isDark ? 'bg-gray-600' : 'bg-gray-300'
          }`}
        />

        {/* Headings */}
        <ToolbarButton
          onClick={() =>
            safeEditorAction((ed) =>
              ed.chain().focus().toggleHeading({ level: 1 }).run()
            )
          }
          isActive={safeIsActive({ level: 1 })}
          title="Heading 1"
        >
          <Heading1 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() =>
            safeEditorAction((ed) =>
              ed.chain().focus().toggleHeading({ level: 2 }).run()
            )
          }
          isActive={safeIsActive({ level: 2 })}
          title="Heading 2"
        >
          <Heading2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() =>
            safeEditorAction((ed) =>
              ed.chain().focus().toggleHeading({ level: 3 }).run()
            )
          }
          isActive={safeIsActive({ level: 3 })}
          title="Heading 3"
        >
          <Heading3 className="h-4 w-4" />
        </ToolbarButton>

        <div
          className={`mx-2 w-px h-6 ${
            isDark ? 'bg-gray-600' : 'bg-gray-300'
          }`}
        />

        {/* Text formatting */}
        <ToolbarButton
          onClick={() =>
            safeEditorAction((ed) => ed.chain().focus().toggleBold().run())
          }
          isActive={safeIsActive('bold')}
          title="Bold"
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() =>
            safeEditorAction((ed) =>
              ed.chain().focus().toggleItalic().run()
            )
          }
          isActive={safeIsActive('italic')}
          title="Italic"
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() =>
            safeEditorAction((ed) => ed.chain().focus().toggleCode().run())
          }
          isActive={safeIsActive('code')}
          title="Inline Code"
        >
          <Code className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() =>
            safeEditorAction((ed) =>
              ed.chain().focus().toggleHighlight().run()
            )
          }
          isActive={safeIsActive('highlight')}
          title="Highlight"
        >
          <Highlighter className="h-4 w-4" />
        </ToolbarButton>

        <div
          className={`mx-2 w-px h-6 ${
            isDark ? 'bg-gray-600' : 'bg-gray-300'
          }`}
        />

        {/* Lists */}
        <ToolbarButton
          onClick={() =>
            safeEditorAction((ed) =>
              ed.chain().focus().toggleBulletList().run()
            )
          }
          isActive={safeIsActive('bulletList')}
          title="Bullet List"
        >
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() =>
            safeEditorAction((ed) =>
              ed.chain().focus().toggleOrderedList().run()
            )
          }
          isActive={safeIsActive('orderedList')}
          title="Numbered List"
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>

        <div
          className={`mx-2 w-px h-6 ${
            isDark ? 'bg-gray-600' : 'bg-gray-300'
          }`}
        />

        {/* Blockquote and Code Block */}
        <ToolbarButton
          onClick={() =>
            safeEditorAction((ed) =>
              ed.chain().focus().toggleBlockquote().run()
            )
          }
          isActive={safeIsActive('blockquote')}
          title="Quote"
        >
          <Quote className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() =>
            safeEditorAction((ed) =>
              ed.chain().focus().toggleCodeBlock().run()
            )
          }
          isActive={safeIsActive('codeBlock')}
          title="Code Block"
        >
          <Code className="h-4 w-4" />
        </ToolbarButton>

        <div
          className={`mx-2 w-px h-6 ${
            isDark ? 'bg-gray-600' : 'bg-gray-300'
          }`}
        />

        {/* Text alignment */}
        <ToolbarButton
          onClick={() =>
            safeEditorAction((ed) =>
              ed.chain().focus().setTextAlign('left').run()
            )
          }
          isActive={safeIsActive({ textAlign: 'left' })}
          title="Align Left"
        >
          <AlignLeft className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() =>
            safeEditorAction((ed) =>
              ed.chain().focus().setTextAlign('center').run()
            )
          }
          isActive={safeIsActive({ textAlign: 'center' })}
          title="Align Center"
        >
          <AlignCenter className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() =>
            safeEditorAction((ed) =>
              ed.chain().focus().setTextAlign('right').run()
            )
          }
          isActive={safeIsActive({ textAlign: 'right' })}
          title="Align Right"
        >
          <AlignRight className="h-4 w-4" />
        </ToolbarButton>

        <div
          className={`mx-2 w-px h-6 ${
            isDark ? 'bg-gray-600' : 'bg-gray-300'
          }`}
        />

        {/* Media and others */}
        <ToolbarButton
          onClick={addImageFromFile}
          disabled={isUploading || !editorReady}
          title={isUploading ? 'Uploading...' : 'Add Image'}
        >
          <ImageIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={addLink}
          isActive={safeIsActive('link')}
          disabled={!editorReady}
          title="Add Link"
        >
          <LinkIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() =>
            safeEditorAction((ed) =>
              ed
                .chain()
                .focus()
                .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                .run()
            )
          }
          disabled={!editorReady}
          title="Insert Table"
        >
          <TableIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() =>
            safeEditorAction((ed) =>
              ed.chain().focus().setHorizontalRule().run()
            )
          }
          disabled={!editorReady}
          title="Horizontal Rule"
        >
          <Minus className="h-4 w-4" />
        </ToolbarButton>
      </div>

      {/* Editor */}
      <div
        className={`min-h-[300px] p-4 prose max-w-none ${
          isDark ? 'prose-invert' : ''
        }`}
      >
        <EditorContent
          editor={editor}
          className="focus:outline-none"
          aria-placeholder={placeholder}
        />
        {isUploading && (
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
            <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
              Uploading image...
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default TiptapEditor;
