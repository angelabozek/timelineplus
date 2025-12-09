"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type Props = {
  id: string;
  idx: number;
  item: { id: string; time: string; label: string };
  editMode: boolean;
  handleItemChange: (index: number, field: "time" | "label", value: string) => void;
  handleDelete: (item: any, index: number) => void;
};

export function SortableItem({
  id,
  idx,
  item,
  editMode,
  handleItemChange,
  handleDelete,
}: Props) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li ref={setNodeRef} style={style} className="flex gap-3 items-start">
      {editMode && (
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab text-slate-400 text-lg pt-1"
        >
          ⋮⋮
        </button>
      )}

      <div className="flex-1">
        {editMode ? (
          <div className="flex gap-2">
            <input
              className="border rounded-md px-2 py-1 text-xs w-20"
              value={item.time}
              onChange={(e) => handleItemChange(idx, "time", e.target.value)}
            />
            <input
              className="border rounded-md px-2 py-1 text-xs flex-1"
              value={item.label}
              onChange={(e) => handleItemChange(idx, "label", e.target.value)}
            />
            <button
              onClick={() => handleDelete(item, idx)}
              className="text-red-500 text-xs"
            >
              Delete
            </button>
          </div>
        ) : (
          <>
            <div className="text-xs font-mono text-slate-500">{item.time}</div>
            <div className="text-sm font-medium text-slate-900">{item.label}</div>
          </>
        )}
      </div>
    </li>
  );
}
