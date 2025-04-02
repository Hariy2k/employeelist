import { Injectable, signal, computed } from '@angular/core';
import { Employee } from '../models/employee.interface';
import { Observable, from, Subject, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class IndexedDBService {
  private dbName = 'EmployeeDB';
  private dbVersion = 2; // Increasing version for schema update
  private storeName = 'employees';
  private db!: IDBDatabase;
  private dataChanged = new Subject<void>();
  private dbReady: Promise<IDBDatabase>;

  // Signal for employees data
  private employeesSignal = signal<Employee[]>([]);
  
  // Computed signals for derived data
  currentEmployees = computed(() => {
    const now = new Date();
    return this.employeesSignal().filter(emp => {
      return !emp.endDate || new Date(emp.endDate) > now;
    }).sort((a, b) => 
      new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
    );
  });
  
  previousEmployees = computed(() => {
    const now = new Date();
    return this.employeesSignal().filter(emp => {
      return emp.endDate && new Date(emp.endDate) <= now;
    }).sort((a, b) => 
      new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
    );
  });
  
  // Signal for loading state
  isLoading = signal(false);
  
  // Signal for error state
  error = signal<string | undefined>(undefined);

  // Observable for legacy compatibility
  dataChanged$ = this.dataChanged.asObservable();

  constructor() {
    this.dbReady = this.initDB();
    // Load employees when service is initialized
    this.loadAllEmployees();
  }

  private initDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
    const request = indexedDB.open(this.dbName, this.dbVersion);

    request.onerror = (event) => {
      console.error('Error opening DB', event);
        reject('Error opening database');
    };

    request.onsuccess = (event) => {
      this.db = (event.target as IDBOpenDBRequest).result;
      console.log('Database opened successfully');
        resolve(this.db);
    };

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;
        const oldVersion = event.oldVersion;
        
        // Creating new store or updating
        if (!db.objectStoreNames.contains(this.storeName)) {
          // Create new object store
      const objectStore = db.createObjectStore(this.storeName, { 
        keyPath: 'id', 
        autoIncrement: true 
      });

          // Create indexes for our new schema
          objectStore.createIndex('name', 'name', { unique: false });
          objectStore.createIndex('position', 'position', { unique: false });
      objectStore.createIndex('startDate', 'startDate', { unique: false });
      objectStore.createIndex('endDate', 'endDate', { unique: false });
        } 
        else if (oldVersion === 1) {
          // Handle migration from v1 to v2
          if (event.target && 'transaction' in event.target) {
            const transaction = (event.target as any).transaction as IDBTransaction;
            
            if (transaction) {
              // Get the object store
              const objectStore = transaction.objectStore(this.storeName);
              
              // Delete old indexes if they exist from previous schema
              if (objectStore.indexNames.contains('employeeName')) {
                objectStore.deleteIndex('employeeName');
              }
              if (objectStore.indexNames.contains('designation')) {
                objectStore.deleteIndex('designation');
              }
              
              // Create new indexes
              if (!objectStore.indexNames.contains('name')) {
                objectStore.createIndex('name', 'name', { unique: false });
              }
              if (!objectStore.indexNames.contains('position')) {
                objectStore.createIndex('position', 'position', { unique: false });
              }
            }
          }
        }
      };
    });
  }

  // Private method to load employees into signal
  private loadAllEmployees(): void {
    this.isLoading.set(true);
    this.error.set(undefined);
    
    from(this.dbReady).pipe(
      switchMap(() => {
        return new Observable<Employee[]>((observer) => {
          try {
            const transaction = this.db.transaction(this.storeName, 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.getAll();

            request.onsuccess = () => {
              const employees = request.result || [];
              
              // Convert old schema to new schema if needed
              const updatedEmployees = employees.map(employee => {
                const newEmployee: Employee = {
                  id: employee.id,
                  name: employee.name || employee.employeeName || '',
                  position: employee.position || employee.designation || '',
                  startDate: employee.startDate || new Date().toISOString(),
                  endDate: employee.endDate === '' ? undefined : employee.endDate
                };
                return newEmployee;
              });
              
              observer.next(updatedEmployees);
              observer.complete();
            };

            request.onerror = () => {
              observer.error(request.error);
            };
          } catch (error) {
            observer.error(error);
          }
        });
      })
    ).subscribe({
      next: (employees) => {
        this.employeesSignal.set(employees);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error loading employees:', err);
        this.error.set('Failed to load employees');
        this.isLoading.set(false);
      }
    });
  }

  // Public method to get all employees (returns signal value)
  getEmployees(): Employee[] {
    return this.employeesSignal();
  }

  // Add a new employee
  addEmployee(employee: Employee): Observable<number> {
    return from(this.dbReady).pipe(
      switchMap(() => {
        return new Observable<number>((observer) => {
          try {
      const transaction = this.db.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.add(employee);

      request.onsuccess = () => {
              const newId = request.result as number;
              
              // Update the signal with the new employee
              this.employeesSignal.update(employees => [
                ...employees, 
                { ...employee, id: newId }
              ]);
              
        this.dataChanged.next();
              observer.next(newId);
              observer.complete();
      };

      request.onerror = () => {
              observer.error(request.error);
            };
          } catch (error) {
            observer.error(error);
          }
        });
      })
    );
  }

  // Legacy method maintained for backward compatibility
  getAllEmployees(): Observable<Employee[]> {
    return of(this.employeesSignal());
  }

  // Update an employee
  updateEmployee(employee: Employee): Observable<void> {
    return from(this.dbReady).pipe(
      switchMap(() => {
        return new Observable<void>((observer) => {
          try {
      const transaction = this.db.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put(employee);

      request.onsuccess = () => {
              // Update the signal with the modified employee
              this.employeesSignal.update(employees => 
                employees.map(emp => emp.id === employee.id ? employee : emp)
              );
              
        this.dataChanged.next();
              observer.next();
              observer.complete();
      };

      request.onerror = () => {
              observer.error(request.error);
            };
          } catch (error) {
            observer.error(error);
          }
        });
      })
    );
  }

  // Delete an employee
  deleteEmployee(id: number): Observable<void> {
    return from(this.dbReady).pipe(
      switchMap(() => {
        return new Observable<void>((observer) => {
          try {
      const transaction = this.db.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(id);

      request.onsuccess = () => {
              // Update the signal by removing the deleted employee
              this.employeesSignal.update(employees => 
                employees.filter(emp => emp.id !== id)
              );
              
        this.dataChanged.next();
              observer.next();
              observer.complete();
      };

      request.onerror = () => {
              observer.error(request.error);
            };
          } catch (error) {
            observer.error(error);
          }
        });
      })
    );
  }

  // Initialize with sample data
  initializeSampleData(employees: Employee[]): Observable<void> {
    return from(this.dbReady).pipe(
      switchMap(() => {
        return new Observable<void>((observer) => {
          try {
      const transaction = this.db.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      // Clear existing data
            const clearRequest = store.clear();

            clearRequest.onsuccess = () => {
              // After clearing, add new employees
      let completed = 0;
              let hasError = false;
              const newEmployees: Employee[] = [];
              
              if (employees.length === 0) {
                this.employeesSignal.set([]);
                this.dataChanged.next();
                observer.next();
                observer.complete();
                return;
              }
              
      employees.forEach(employee => {
        const request = store.add(employee);
        
        request.onsuccess = () => {
                  const newId = request.result as number;
                  newEmployees.push({ ...employee, id: newId });
                  
          completed++;
                  if (completed === employees.length && !hasError) {
                    this.employeesSignal.set(newEmployees);
            this.dataChanged.next();
                    observer.next();
                    observer.complete();
                  }
                };

                request.onerror = (e) => {
                  if (!hasError) {
                    hasError = true;
                    observer.error(request.error);
                  }
        };
      });
            };
            
            clearRequest.onerror = () => {
              observer.error(clearRequest.error);
            };
          } catch (error) {
            observer.error(error);
          }
        });
      })
    );
  }
}
