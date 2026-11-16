import { Component, signal } from '@angular/core';
import { ArgusColumnComponent, ArgusTableComponent } from '@argus-table/angular';
import { tasks } from '../../data';

@Component({
  selector: 'app-declarative',
  imports: [ArgusTableComponent, ArgusColumnComponent],
  template: `
    <button type="button" (click)="ownerHidden.set(!ownerHidden())">
      {{ ownerHidden() ? 'Show Owner' : 'Hide Owner' }}
    </button>
    <argus-table aria-label="Tasks" style="display: block; block-size: 280px" [data]="tasks">
      <argus-column
        column-id="id"
        header="#"
        accessor="id"
        width="70"
        pin="start"
        hideable="false"
      />
      <argus-column column-id="title" header="Title" accessor="title" width="2fr" />
      <!-- The standard hidden attribute hides a column. -->
      <argus-column column-id="owner" header="Owner" accessor="owner" [hidden]="ownerHidden()" />
      <argus-column column-id="status" header="Status" accessor="status" />
    </argus-table>
  `,
})
export class DeclarativeComponent {
  protected readonly tasks = tasks;
  protected readonly ownerHidden = signal(true);
}
