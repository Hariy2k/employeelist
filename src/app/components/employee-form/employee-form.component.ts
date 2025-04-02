import { Component, OnInit, ViewChild, TemplateRef, OnDestroy, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatDatepicker } from '@angular/material/datepicker';
import { Subscription } from 'rxjs';
import { Employee } from '../../models/employee.interface';
import { IndexedDBService } from '../../services/indexed-db.service';

@Component({
  selector: 'app-employee-form',
  templateUrl: './employee-form.component.html',
  styleUrls: ['./employee-form.component.css']
})
export class EmployeeFormComponent implements OnInit, OnDestroy {
  employeeForm: FormGroup;
  
  // Convert to signals
  isEditMode = signal(false);
  employeeId = signal<number | undefined>(undefined);
  isLoading = signal(false);
  error = signal<string | undefined>(undefined);
  
  // Dialog state signals
  tempStartDate = signal<Date | undefined>(undefined);
  tempEndDate = signal<Date | undefined>(undefined);
  currentDate = signal(new Date());
  
  private subscriptions: Subscription = new Subscription();

  @ViewChild('startDatePicker') startDatePicker!: MatDatepicker<Date>;
  @ViewChild('endDatePicker') endDatePicker!: MatDatepicker<Date>;
  @ViewChild('startDatePickerTemplate') startDatePickerTemplate!: TemplateRef<any>;
  @ViewChild('endDatePickerTemplate') endDatePickerTemplate!: TemplateRef<any>;
  @ViewChild('roleSelectorTemplate') roleSelectorTemplate!: TemplateRef<any>;

  startDateDialogRef?: MatDialogRef<any>;
  endDateDialogRef?: MatDialogRef<any>;

  roles: string[] = [
    "Flutter Developer",
    "React Developer",
    "Angular Developer",
    "Product Manager",
    "QA Engineer",
    "Full-stack Developer"
  ];
  private roleSelectorDialog: MatDialogRef<any> | null = null;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private dbService: IndexedDBService,
    private dialog: MatDialog
  ) {
    this.employeeForm = this.fb.group({
      name: ['', Validators.required],
      position: ['', Validators.required],
      startDate: [new Date(), Validators.required],
      endDate: [null]
    });
  }

  ngOnInit(): void {
    this.subscriptions.add(
      this.route.params.subscribe(params => {
        if (params['id']) {
          this.isEditMode.set(true);
          this.employeeId.set(+params['id']);
          this.loadEmployeeData(this.employeeId());
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  loadEmployeeData(id: number | undefined): void {
    if (!id) return;
    
    this.isLoading.set(true);
    this.error.set(undefined);
    
    this.subscriptions.add(
      this.dbService.getAllEmployees().subscribe({
        next: employees => {
          const employee = employees.find(emp => emp.id === id);
          if (employee) {
            this.employeeForm.patchValue({
              name: employee.name,
              position: employee.position,
              startDate: employee.startDate ? new Date(employee.startDate) : new Date(),
              endDate: employee.endDate ? new Date(employee.endDate) : null
            });
          }
          this.isLoading.set(false);
        },
        error: err => {
          console.error('Error loading employee data:', err);
          this.error.set('Failed to load employee data');
          this.isLoading.set(false);
        }
      })
    );
  }

  onSubmit(): void {
    if (this.employeeForm.valid) {
      const formValue = this.employeeForm.value;

      const employee: Employee = {
        name: formValue.name,
        position: formValue.position,
        startDate: formValue.startDate ? formValue.startDate.toISOString() : new Date().toISOString(),
        endDate: formValue.endDate ? formValue.endDate.toISOString() : undefined
      };

      if (this.isEditMode() && this.employeeId()) {
        employee.id = this.employeeId();
        this.subscriptions.add(
          this.dbService.updateEmployee(employee).subscribe({
            next: () => {
              this.router.navigate(['/employees']);
            },
            error: (err) => {
              console.error('Error updating employee:', err);
              this.error.set('Failed to update employee');
            }
          })
        );
      } else {
        this.subscriptions.add(
          this.dbService.addEmployee(employee).subscribe({
            next: () => {
              this.router.navigate(['/employees']);
            },
            error: (err) => {
              console.error('Error adding employee:', err);
              this.error.set('Failed to add employee');
            }
          })
        );
      }
    }
  }

  cancel(): void {
    this.router.navigate(['/employees']);
  }

  // Custom date picker methods for Start Date
  openStartDatePicker(): void {
    const currentValue = this.employeeForm.get('startDate')?.value;
    this.tempStartDate.set(currentValue);
    
    this.startDateDialogRef = this.dialog.open(this.startDatePickerTemplate, {
      width: '360px',
      panelClass: 'custom-dialog'
    });
  }

  closeStartDatePicker(): void {
    if (this.startDateDialogRef) {
      this.startDateDialogRef.close();
    }
  }

  selectStartDate(date: Date): void {
    this.tempStartDate.set(date);
  }

  saveStartDate(): void {
    if (this.tempStartDate()) {
      this.employeeForm.patchValue({
        startDate: this.tempStartDate()
      });
    }
    this.closeStartDatePicker();
  }

  selectStartDateShortcut(type: string): void {
    let date = new Date();

    switch (type) {
      case 'today':
        // Already set to today
        break;
      case 'nextMonday':
        date = this.getNextDayOfWeek(1); // 1 = Monday
        break;
      case 'nextTuesday':
        date = this.getNextDayOfWeek(2); // 2 = Tuesday
        break;
      case 'afterOneWeek':
        date = new Date();
        date.setDate(date.getDate() + 7);
        break;
    }

    this.tempStartDate.set(date);
  }

  // Custom date picker methods for End Date
  openEndDatePicker(): void {
    const currentValue = this.employeeForm.get('endDate')?.value;
    this.tempEndDate.set(currentValue);
    
    this.endDateDialogRef = this.dialog.open(this.endDatePickerTemplate, {
      width: '360px',
      panelClass: 'custom-dialog'
    });
  }

  closeEndDatePicker(): void {
    if (this.endDateDialogRef) {
      this.endDateDialogRef.close();
    }
  }

  selectEndDate(date: Date): void {
    this.tempEndDate.set(date);
  }

  saveEndDate(): void {
    this.employeeForm.patchValue({
      endDate: this.tempEndDate()
    });
    this.closeEndDatePicker();
  }

  selectEndDateShortcut(type: string): void {
    switch (type) {
      case 'none':
        this.tempEndDate.set(undefined);
        break;
      case 'today':
        this.tempEndDate.set(new Date());
        break;
    }
  }

  // Helper methods for date comparison
  isToday(date?: Date): boolean {
    if (!date) return false;

    const today = new Date();
    return date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
  }

  isNextMonday(date?: Date): boolean {
    if (!date) return false;

    const nextMonday = this.getNextDayOfWeek(1);
    return date.getDate() === nextMonday.getDate() &&
      date.getMonth() === nextMonday.getMonth() &&
      date.getFullYear() === nextMonday.getFullYear();
  }

  isNextTuesday(date?: Date): boolean {
    if (!date) return false;

    const nextTuesday = this.getNextDayOfWeek(2);
    return date.getDate() === nextTuesday.getDate() &&
      date.getMonth() === nextTuesday.getMonth() &&
      date.getFullYear() === nextTuesday.getFullYear();
  }

  isAfterOneWeek(date?: Date): boolean {
    if (!date) return false;

    const afterOneWeek = new Date();
    afterOneWeek.setDate(afterOneWeek.getDate() + 7);
    return date.getDate() === afterOneWeek.getDate() &&
      date.getMonth() === afterOneWeek.getMonth() &&
      date.getFullYear() === afterOneWeek.getFullYear();
  }

  private getNextDayOfWeek(dayOfWeek: number): Date {
    const today = new Date();
    const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    // Calculate days to add - if today is the target day, jump to next week
    const daysToAdd = dayOfWeek > currentDay 
      ? dayOfWeek - currentDay 
      : 7 - currentDay + dayOfWeek;
    
    const nextDay = new Date();
    nextDay.setDate(today.getDate() + daysToAdd);
    return nextDay;
  }

  prevMonth(): void {
    const currentDate = this.tempStartDate() || new Date();
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() - 1);
    this.tempStartDate.set(newDate);
  }

  nextMonth(): void {
    const currentDate = this.tempStartDate() || new Date();
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + 1);
    this.tempStartDate.set(newDate);
  }

  prevMonthEnd(): void {
    if (this.tempEndDate()) {
      const newDate = new Date(this.tempEndDate()!);
      newDate.setMonth(newDate.getMonth() - 1);
      this.tempEndDate.set(newDate);
    } else {
      const newDate = new Date(this.currentDate());
      newDate.setMonth(newDate.getMonth() - 1);
      this.currentDate.set(newDate);
    }
  }

  nextMonthEnd(): void {
    if (this.tempEndDate()) {
      const newDate = new Date(this.tempEndDate()!);
      newDate.setMonth(newDate.getMonth() + 1);
      this.tempEndDate.set(newDate);
    } else {
      const newDate = new Date(this.currentDate());
      newDate.setMonth(newDate.getMonth() + 1);
      this.currentDate.set(newDate);
    }
  }

  openRoleSelector(): void {
    // Close any existing dialog first
    if (this.roleSelectorDialog) {
      this.roleSelectorDialog.close();
    }

    // Open the role selector as a full-screen dialog
    this.roleSelectorDialog = this.dialog.open(this.roleSelectorTemplate, {
      maxWidth: '100vw',
      width: '100%',
      height: 'auto',
      position: { bottom: '0' },
      panelClass: ['role-selector-dialog'],
      backdropClass: 'role-selector-backdrop',
      hasBackdrop: true
    });

    // Handle backdrop click
    this.roleSelectorDialog.backdropClick().subscribe(() => {
      this.closeRoleSelector();
    });
  }

  closeRoleSelector(): void {
    if (this.roleSelectorDialog) {
      this.roleSelectorDialog.close();
      this.roleSelectorDialog = null;
    }
  }

  selectRole(role: string): void {
    this.employeeForm.patchValue({ position: role });
    this.closeRoleSelector();
  }
}
