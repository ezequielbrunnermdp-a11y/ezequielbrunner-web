import { PRIORITIES, PRIORITY_LABELS } from "@/lib/tasks/transitions";
import { Input, Label, Select, Textarea } from "./ui";

export interface TaskDefaults {
  title?: string;
  description?: string | null;
  priority?: string;
  assignee_label?: string | null;
  due_date?: string | null;
  branch_id?: string | null;
}

export function TaskFields({ branches, d = {}, idp = "t" }: { branches: { id: string; name: string }[]; d?: TaskDefaults; idp?: string }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Label htmlFor={`${idp}-title`}>Título</Label>
        <Input id={`${idp}-title`} name="title" defaultValue={d.title} required minLength={3} maxLength={200} />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor={`${idp}-desc`} hint="opcional">Descripción</Label>
        <Textarea id={`${idp}-desc`} name="description" defaultValue={d.description ?? ""} rows={2} />
      </div>
      <div>
        <Label htmlFor={`${idp}-as`} hint="opcional">Responsable</Label>
        <Input id={`${idp}-as`} name="assignee_label" defaultValue={d.assignee_label ?? ""} />
      </div>
      <div>
        <Label htmlFor={`${idp}-due`} hint="opcional">Vence</Label>
        <Input id={`${idp}-due`} name="due_date" type="date" defaultValue={d.due_date ?? ""} />
      </div>
      <div>
        <Label htmlFor={`${idp}-pr`}>Prioridad</Label>
        <Select id={`${idp}-pr`} name="priority" defaultValue={d.priority ?? "medium"}>
          {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
        </Select>
      </div>
      <div>
        <Label htmlFor={`${idp}-br`}>Sucursal</Label>
        <Select id={`${idp}-br`} name="branch_id" defaultValue={d.branch_id ?? ""}>
          <option value="">Sin sucursal</option>
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </Select>
      </div>
    </div>
  );
}
