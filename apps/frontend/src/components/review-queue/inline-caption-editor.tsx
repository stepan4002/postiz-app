'use client';

import React, { FC, useState } from 'react';

interface InlineCaptionEditorProps {
  initialCaption: string;
  onSave: (editedCaption: string) => void;
  onCancel: () => void;
}

/**
 * InlineCaptionEditor
 *
 * Inline textarea editor for editing an individual variant caption.
 * Provides "Save & Approve" and "Cancel" actions.
 */
export const InlineCaptionEditor: FC<InlineCaptionEditorProps> = ({
  initialCaption,
  onSave,
  onCancel,
}) => {
  const [editedCaption, setEditedCaption] = useState(initialCaption);

  const handleSave = () => {
    onSave(editedCaption);
  };

  return (
    <div className="flex flex-col gap-2 mt-2">
      <textarea
        className="w-full rounded-lg border border-newBorder p-2 bg-newBgColorInner dark:bg-gray-700 dark:border-gray-600 text-textColor text-sm resize-none min-h-[100px] focus:outline-none focus:ring-1 focus:ring-btnPrimary"
        value={editedCaption}
        onChange={(e) => setEditedCaption(e.target.value)}
        rows={4}
        autoFocus
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          className="rounded-lg px-3 py-1.5 text-sm font-medium bg-green-600 hover:bg-green-700 text-white transition-colors"
        >
          Save & Approve
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-3 py-1.5 text-sm font-medium bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};
