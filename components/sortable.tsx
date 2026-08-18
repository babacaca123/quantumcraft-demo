"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

/**
 * Vertical drag-to-reorder used for both phases and tasks (spec §2 and §4).
 * The pointer sensor needs a few pixels of travel before it engages so that
 * clicking a checkbox or link inside a row still behaves like a click.
 */
export function SortableList({
  ids,
  onReorder,
  children,
}: {
  ids: string[];
  onReorder: (nextIds: string[]) => void;
  children: React.ReactNode;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from === -1 || to === -1) return;

    onReorder(arrayMove(ids, from, to));
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}

/**
 * One draggable row. Children get a ready-made handle element to place wherever
 * the row's layout wants it — dragging is handle-only so the rest of the row
 * stays clickable.
 */
export function SortableRow({
  id,
  className,
  children,
}: {
  id: string;
  className?: string;
  children: (handle: React.ReactNode) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const handle = (
    <button
      type="button"
      ref={setActivatorNodeRef}
      className="iconbtn bare drag"
      aria-label="Drag to reorder"
      {...attributes}
      {...listeners}
    >
      ⠿
    </button>
  );

  return (
    <div
      ref={setNodeRef}
      className={[className, isDragging ? "dragging" : ""].filter(Boolean).join(" ")}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        position: "relative",
        zIndex: isDragging ? 2 : undefined,
      }}
    >
      {children(handle)}
    </div>
  );
}
