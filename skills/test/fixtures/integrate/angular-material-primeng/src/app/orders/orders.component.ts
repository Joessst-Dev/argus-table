import { AfterViewInit, Component, ViewChild } from '@angular/core';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';

export interface Order {
  id: string;
  customer: string;
  total: number;
}

@Component({
  selector: 'app-orders',
  imports: [MatTableModule, MatSortModule, MatPaginatorModule],
  templateUrl: './orders.component.html',
})
export class OrdersComponent implements AfterViewInit {
  readonly displayedColumns = ['id', 'customer', 'total'];
  readonly dataSource = new MatTableDataSource<Order>([]);
  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  ngAfterViewInit() {
    this.dataSource.sort = this.sort;
    this.dataSource.paginator = this.paginator;
    this.dataSource.filterPredicate = (row, filter) => row.customer.toLowerCase().includes(filter);
  }

  applyFilter(value: string) {
    this.dataSource.filter = value.trim().toLowerCase();
  }
}
