"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export function SortableItem({
  id,
  idx,
  item,
  editMode,
  handleItemChange,
  setItems,
}: any) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li ref={setNodeRef} style={style} className="flex gap-4 items-start">
      {/* Drag Handle */}
      {editMode && (
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-slate-400 mr-2"
        >
          ⋮⋮
        </button>
      )}

      {/* Timeline visual connector */}
      <div className="flex flex-col items-center">
        <div className="w-2 h-2 rounded-full bg-slate-600 mt-2" />
        {idx !== undefined && idx !== null && (
          <div className="w-px flex-1 bg-slate-200 mt-1" />
        )}
      </div>

      {/* Item content */}
      <div className="flex-1 flex flex-col gap-1">
        {editMode ? (
          <div className="flex flex-col sm:flex-row gap-2 items-start">
            <input
              className="border rounded-md px-2 py-1 text-xs w-24"
              value={item.time}
              onChange={(e) =>
                handleItemChange(idx, "time", e.target.value)
              }
            />
            <input
              className="border rounded-md px-2 py-1 text-xs flex-1"
              value={item.label}
              onChange={(e) =>
                handleItemChange(idx, "label", e.target.value)
              }
            />
            <button
              onClick={() =>
                setItems((prev: any) => prev.filter((_, i) => i !== idx))
              }
              className="text-red-500 text-xs ml-2"
            >
              Delete
            </button>
          </div>
        ) : (
          <>
            <div className="text-xs font-mono text-slate-500">
              {item.time}
            </div>
            <div className="text-sm font-medium text-slate-900">
              {item.label}
            </div>
          </>
        )}
      </div>
    </li>
  );
}
