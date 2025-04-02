export interface Employee {
  id?: number;  // IndexedDB will auto-generate this
  name: string;
  position: string;
  startDate: string;
  endDate?: string; // Optional end date
}
