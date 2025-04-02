import { Component, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { Employee } from '../../models/employee.interface';
import { IndexedDBService } from '../../services/indexed-db.service';
import { MatDialog } from '@angular/material/dialog';
import { CdkDragEnd, CdkDragMove } from '@angular/cdk/drag-drop';

@Component({
  selector: 'app-employee-list',
  templateUrl: './employee-list.component.html',
  styleUrls: ['./employee-list.component.css']
})
export class EmployeeListComponent implements OnInit, OnDestroy {
  // Define signals for reactive state
  employees = signal<Employee[]>([]);
  currentEmployees = computed(() => this.filterCurrentEmployees());
  previousEmployees = computed(() => this.filterPreviousEmployees());
  isLoading = signal(true);
  error = signal<string | undefined>(undefined);
  isDragging = signal(false);
  deletingEmployeeIds = signal<number[]>([]);

  private subscription: Subscription = new Subscription();
  private readonly SWIPE_DELETE_THRESHOLD = -80; // Pixels to trigger delete
  private draggedOffset = 0;

  constructor(
    private dbService: IndexedDBService,
    private router: Router,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.loadEmployees();

    // Subscribe to data changes
    this.subscription.add(
      this.dbService.dataChanged$.subscribe(() => {
        this.loadEmployees();
      })
    );
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  loadEmployees(): void {
    this.isLoading.set(true);
    this.error.set(undefined);
    
    this.subscription.add(
      this.dbService.getAllEmployees().subscribe({
        next: (employees) => {
          this.employees.set(employees);
          this.isLoading.set(false);
        },
        error: (err) => {
          console.error('Error loading employees:', err);
          this.error.set('Failed to load employees. Please try again.');
          this.isLoading.set(false);
        }
      })
    );
  }

  private filterCurrentEmployees(): Employee[] {
    const now = new Date();
    return this.employees().filter(emp => {
      // If there is no end date, or end date is in the future, employee is current
      return !emp.endDate || new Date(emp.endDate) > now;
    }).sort((a, b) => 
      new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
    );
  }

  private filterPreviousEmployees(): Employee[] {
    const now = new Date();
    return this.employees().filter(emp => {
      // If there is an end date in the past, employee is previous
      return emp.endDate && new Date(emp.endDate) <= now;
    }).sort((a, b) => 
      new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
    );
  }

  addEmployee(): void {
    this.router.navigate(['/employee/add']);
  }

  editEmployee(employee: Employee): void {
    // Only check if the employee is being deleted
    if (employee.id !== undefined && !this.isDeleting(employee)) {
      this.router.navigate(['/employee/edit', employee.id]);
    }
  }

  deleteEmployee(employee: Employee): void {
    if (employee && employee.id !== undefined) {
      const employeeId = employee.id;
      
      // Reset draggedOffset
      this.draggedOffset = 0;
      
      // Update the employees signal to remove the deleted employee
      this.employees.update(emps => emps.filter(e => e.id !== employeeId));
      
      // Then update the database
      this.subscription.add(
        this.dbService.deleteEmployee(employeeId).subscribe({
          next: () => {
            console.log(`Employee deleted successfully`);
            // Remove from the deleting ids
            this.deletingEmployeeIds.update(ids => ids.filter(id => id !== employeeId));
          },
          error: (err) => {
            console.error('Error deleting employee:', err);
            this.error.set('Failed to delete employee. Please try again.');
            
            // Remove from the deleting ids
            this.deletingEmployeeIds.update(ids => ids.filter(id => id !== employeeId));
            
            // If there was an error, reload all employees to restore state
            this.loadEmployees();
          }
        })
      );
    }
  }

  // Check if an employee is being deleted
  isDeleting(employee: Employee): boolean {
    return employee.id !== undefined && this.deletingEmployeeIds().includes(employee.id);
  }

  // Track the drag start 
  onDragStarted(): void {
    this.isDragging.set(true);
    this.draggedOffset = 0;
  }

  // Track the drag movement
  onDragMoved(event: CdkDragMove): void {
    // Only allow left swipe (negative x values)
    if (event.distance.x > 0) {
      event.source.reset();
      return;
    }
    this.draggedOffset = event.distance.x;
  }

  // Handle when the drag ends
  onDragEnded(event: CdkDragEnd, employee: Employee): void {
    this.isDragging.set(false);
    
    // Always reset the drag position
    event.source.reset();
    
    // If dragged past threshold, trigger delete
    if (this.draggedOffset <= this.SWIPE_DELETE_THRESHOLD) {
      this.confirmDelete(employee);
    }
    
    // Reset the offset
    this.draggedOffset = 0;
  }

  // Confirm and execute deletion
  confirmDelete(employee: Employee): void {
    if (employee.id !== undefined && !this.isDeleting(employee)) {
      // Add to deleting ids
      this.deletingEmployeeIds.update(ids => [...ids, employee.id!]);
      
      // Reset draggedOffset
      this.draggedOffset = 0;
      
      // Delay the actual delete to allow animation to show
      setTimeout(() => {
        this.deleteEmployee(employee);
      }, 300); // Match with CSS transition duration
    }
  }

  formatDateRange(employee: Employee): string {
    const startDate = new Date(employee.startDate);
    
    if (!employee.endDate) {
      return `From ${this.formatDate(startDate)}`;
    }
    
    const endDate = new Date(employee.endDate);
    return `${this.formatDate(startDate)} - ${this.formatDate(endDate)}`;
  }
  
  private formatDate(date: Date): string {
    const day = date.getDate();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear();
    
    return `${day} ${month}, ${year}`;
  }

  // Track items by id for optimized rendering
  trackById(index: number, employee: Employee): number {
    return employee.id !== undefined ? employee.id : index;
  }
}
