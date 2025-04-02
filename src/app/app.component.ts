import { Component, OnInit } from '@angular/core';
import { IndexedDBService } from './services/indexed-db.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  title = 'employeelist';

  constructor(private dbService: IndexedDBService) {}

  ngOnInit(): void {
    // Initialize with sample data
    const sampleEmployees = [
      // Current employees (no end date)
      {
        name: 'Samantha Lee',
        position: 'Flutter Developer',
        startDate: new Date('2022-09-21').toISOString(),
        endDate: ''
      },
      {
        name: 'David Kim',
        position: 'React Developer',
        startDate: new Date('2022-07-01').toISOString(),
        endDate: ''
      },
      // Previous employees (with end date)
      {
        name: 'Emily Davis',
        position: 'Product Manager',
        startDate: new Date('2022-09-21').toISOString(),
        endDate: new Date('2023-01-01').toISOString()
      },
      {
        name: 'Jason Patel',
        position: 'QA Engineer',
        startDate: new Date('2022-07-01').toISOString(),
        endDate: new Date('2022-12-31').toISOString()
      }
    ];

    this.dbService.initializeSampleData(sampleEmployees).subscribe({
      next: () => console.log('Sample data initialized successfully'),
      error: (err) => console.error('Error initializing sample data:', err)
    });
  }
}
