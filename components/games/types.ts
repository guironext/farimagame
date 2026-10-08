import type { TableView } from "@/lib/types";

export interface BoardProps<S> {
  table: TableView;
  state: S;
  mySeat: number | null;
  canPlay: boolean; // c'est mon tour et la partie est en cours
  busy: boolean;
  onMove: (move: unknown) => void;
}
