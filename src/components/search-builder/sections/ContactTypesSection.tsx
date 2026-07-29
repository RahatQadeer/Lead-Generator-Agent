"use client";

/** Which contact channels to collect for each decision maker. */
import { Controller, type Control } from "react-hook-form";
import { AtSign } from "lucide-react";
import { ChipGroup } from "@/components/search-builder/fields/ChipGroup";
import { FieldShell } from "@/components/search-builder/fields/FieldShell";
import { SectionShell } from "@/components/search-builder/sections/SectionShell";
import { CONTACT_TYPE_LABELS } from "@/lib/search-builder/labels";
import { CONTACT_TYPES, type SearchBuilderInput } from "@/lib/search-builder/schema";

interface Props {
  control: Control<SearchBuilderInput>;
}

export function ContactTypesSection({ control }: Props) {
  return (
    <SectionShell
      icon={AtSign}
      title="Contact details"
      description="Only publicly published business contact details are collected."
    >
      <Controller
        control={control}
        name="contactTypes"
        render={({ field }) => (
          <FieldShell
            id="contactTypes"
            label="Channels to collect"
            description="Channels that can't be found are left blank rather than failing the run."
          >
            <ChipGroup
              id="contactTypes"
              hasDescription
              options={CONTACT_TYPES.map((type) => ({
                value: type,
                label: CONTACT_TYPE_LABELS[type],
              }))}
              value={field.value ?? []}
              onChange={field.onChange}
            />
          </FieldShell>
        )}
      />
    </SectionShell>
  );
}
