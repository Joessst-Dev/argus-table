import { Component, signal } from '@angular/core';
import {
  ArgusTableComponent,
  type SelectionState,
  type TreeExpandedState,
} from '@argus-table/angular';
import { describeSelection, managerOf, people, personColumns, personId } from '../../data';

@Component({
  selector: 'app-org-chart',
  imports: [ArgusTableComponent],
  template: `
    <p>
      <label>
        Search people
        <input type="search" [value]="search()" (input)="search.set(valueOf($event))" />
      </label>
    </p>
    <!-- Flat data: every person is in data, and names their manager by id. -->
    <!-- selectBranches: ticking a manager ticks everyone under them. -->
    <argus-table
      aria-label="People"
      style="display: block; block-size: 380px"
      selectionMode="multi"
      selectionCheckboxes
      selectBranches
      [columns]="columns"
      [data]="people"
      [getRowId]="personId"
      [getParentId]="managerOf"
      [(treeExpanded)]="treeExpanded"
      [(selection)]="selection"
      [quickFilter]="search()"
    />
    <p>
      <output>{{ describe(selection()) }}</output>
    </p>
  `,
})
export class OrgChartComponent {
  protected readonly columns = personColumns;
  protected readonly people = people;
  protected readonly personId = personId;
  protected readonly managerOf = managerOf;
  protected readonly describe = describeSelection;
  protected readonly treeExpanded = signal<TreeExpandedState>(['p1']);
  protected readonly selection = signal<SelectionState>([]);
  protected readonly search = signal('');

  protected valueOf(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }
}
