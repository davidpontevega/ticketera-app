"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

import { EVENT_PRICE_BUCKETS } from "../constants/event.constants";
import type {
  EventCategory,
  EventFilterOption,
  EventPriceBucket,
  EventSearchParams,
} from "../types/event.types";
import { toggleValue } from "../utils/event-search.utils";

export interface EventSearchFiltersProps {
  params: EventSearchParams;
  categoryOptions?: readonly EventFilterOption[]; // se omite en mobile (hay chips de categoria)
  cityOptions: readonly EventFilterOption[];
  monthOptions: readonly EventFilterOption[];
  onChange: (params: EventSearchParams) => void;
  idPrefix: string; // ids unicos: el aside desktop y el sheet mobile pueden coexistir en el DOM
}

const ANY_VALUE = "any";

interface CheckboxGroupProps {
  legend: string;
  options: readonly EventFilterOption[];
  selected: readonly string[];
  onToggle: (value: string) => void;
  idPrefix: string;
}

function CheckboxGroup({ legend, options, selected, onToggle, idPrefix }: CheckboxGroupProps) {
  return (
    <FieldSet className="gap-2">
      <FieldLegend variant="label" className="text-sm font-semibold">
        {legend}
      </FieldLegend>
      {options.map((option) => {
        const id = `${idPrefix}-${option.value}`;
        return (
          <Field key={option.value} orientation="horizontal" className="min-h-8 gap-2.5">
            <Checkbox
              id={id}
              checked={selected.includes(option.value)}
              onCheckedChange={() => onToggle(option.value)}
            />
            <FieldLabel htmlFor={id} className="flex-1 cursor-pointer text-sm font-normal">
              {option.label}
            </FieldLabel>
            <span className="text-xs text-muted-foreground tabular-nums">{option.count}</span>
          </Field>
        );
      })}
    </FieldSet>
  );
}

interface RadioOptionsProps {
  legend: string;
  anyLabel: string;
  options: readonly { value: string; label: string }[];
  value: string | null;
  onValueChange: (value: string | null) => void;
  idPrefix: string;
}

function RadioOptions({
  legend,
  anyLabel,
  options,
  value,
  onValueChange,
  idPrefix,
}: RadioOptionsProps) {
  const allOptions = [{ value: ANY_VALUE, label: anyLabel }, ...options];
  return (
    <FieldSet className="gap-2">
      <FieldLegend variant="label" className="text-sm font-semibold">
        {legend}
      </FieldLegend>
      <RadioGroup
        value={value ?? ANY_VALUE}
        onValueChange={(next) => onValueChange(next === ANY_VALUE ? null : String(next))}
        aria-label={legend}
        className="gap-2"
      >
        {allOptions.map((option) => {
          const id = `${idPrefix}-${option.value}`;
          return (
            <Field key={option.value} orientation="horizontal" className="min-h-8 gap-2.5">
              <RadioGroupItem value={option.value} id={id} />
              <FieldLabel
                htmlFor={id}
                className="cursor-pointer text-sm font-normal"
              >
                {option.label}
              </FieldLabel>
            </Field>
          );
        })}
      </RadioGroup>
    </FieldSet>
  );
}

export function EventSearchFilters({
  params,
  categoryOptions,
  cityOptions,
  monthOptions,
  onChange,
  idPrefix,
}: EventSearchFiltersProps) {
  return (
    <div className="flex flex-col gap-6">
      {categoryOptions && (
        <CheckboxGroup
          legend="Categoria"
          options={categoryOptions}
          selected={params.categories}
          onToggle={(value) =>
            onChange({
              ...params,
              categories: toggleValue(params.categories, value as EventCategory),
            })
          }
          idPrefix={`${idPrefix}-category`}
        />
      )}
      <CheckboxGroup
        legend="Ciudad"
        options={cityOptions}
        selected={params.cities}
        onToggle={(value) => onChange({ ...params, cities: toggleValue(params.cities, value) })}
        idPrefix={`${idPrefix}-city`}
      />
      <RadioOptions
        legend="Fecha"
        anyLabel="Cualquier fecha"
        options={monthOptions}
        value={params.month}
        onValueChange={(month) => onChange({ ...params, month })}
        idPrefix={`${idPrefix}-month`}
      />
      <RadioOptions
        legend="Precio desde"
        anyLabel="Cualquier precio"
        options={EVENT_PRICE_BUCKETS}
        value={params.price}
        onValueChange={(price) => onChange({ ...params, price: price as EventPriceBucket | null })}
        idPrefix={`${idPrefix}-price`}
      />
    </div>
  );
}
