/**
 * Font Select Component
 *
 * AIDEV-NOTE: Dropdown for selecting web fonts with live preview
 * Includes popular system and web fonts, plus custom option
 */

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface FontOption {
  value: string;
  label: string;
  fontFamily: string;
  category: "system" | "sans-serif" | "serif" | "monospace";
}

// AIDEV-NOTE: Using system fonts only - no web font loading required
// These are universally available across platforms without external resources
const FONT_OPTIONS: FontOption[] = [
  {
    value: "system-default",
    label: "System Default",
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    category: "system",
  },
  {
    value: "system-ui",
    label: "System UI",
    fontFamily: "system-ui, sans-serif",
    category: "system",
  },
  // Sans-Serif fonts
  {
    value: "helvetica",
    label: "Helvetica Neue",
    fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
    category: "sans-serif",
  },
  {
    value: "arial",
    label: "Arial",
    fontFamily: "Arial, 'Helvetica Neue', Helvetica, sans-serif",
    category: "sans-serif",
  },
  {
    value: "segoe-ui",
    label: "Segoe UI",
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    category: "sans-serif",
  },
  {
    value: "verdana",
    label: "Verdana",
    fontFamily: "Verdana, Geneva, Tahoma, sans-serif",
    category: "sans-serif",
  },
  {
    value: "trebuchet",
    label: "Trebuchet MS",
    fontFamily: "'Trebuchet MS', 'Lucida Grande', 'Lucida Sans Unicode', sans-serif",
    category: "sans-serif",
  },
  // Serif fonts
  {
    value: "georgia",
    label: "Georgia",
    fontFamily: "Georgia, 'Times New Roman', Times, serif",
    category: "serif",
  },
  {
    value: "times",
    label: "Times New Roman",
    fontFamily: "'Times New Roman', Times, Georgia, serif",
    category: "serif",
  },
  {
    value: "palatino",
    label: "Palatino",
    fontFamily: "Palatino, 'Palatino Linotype', 'Book Antiqua', Georgia, serif",
    category: "serif",
  },
  {
    value: "garamond",
    label: "Garamond",
    fontFamily: "Garamond, Baskerville, 'Baskerville Old Face', 'Hoefler Text', serif",
    category: "serif",
  },
  // Monospace fonts
  {
    value: "menlo",
    label: "Menlo",
    fontFamily: "Menlo, Monaco, 'Courier New', Courier, monospace",
    category: "monospace",
  },
  {
    value: "monaco",
    label: "Monaco",
    fontFamily: "Monaco, Menlo, Consolas, 'Courier New', monospace",
    category: "monospace",
  },
  {
    value: "consolas",
    label: "Consolas",
    fontFamily: "Consolas, Monaco, 'Lucida Console', 'Liberation Mono', monospace",
    category: "monospace",
  },
  {
    value: "courier",
    label: "Courier New",
    fontFamily: "'Courier New', Courier, 'Lucida Sans Typewriter', monospace",
    category: "monospace",
  },
];

interface FontSelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

export function FontSelect({
  label,
  value,
  onChange,
  disabled,
  className,
}: FontSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [showCustomInput, setShowCustomInput] = React.useState(false);

  // Check if current value matches a preset
  const matchedOption = FONT_OPTIONS.find((opt) => opt.fontFamily === value);
  const isCustom = !matchedOption && value !== "";

  // Show custom input if value doesn't match any preset
  React.useEffect(() => {
    setShowCustomInput(isCustom);
  }, [isCustom]);

  const handleSelectPreset = (fontFamily: string) => {
    onChange(fontFamily);
    setShowCustomInput(false);
    setOpen(false);
  };

  const handleSelectCustom = () => {
    setShowCustomInput(true);
    setOpen(false);
  };

  const displayValue = matchedOption?.label || (isCustom ? "Custom" : "Select font...");

  return (
    <div className={cn("space-y-2", className)}>
      {label && <Label>{label}</Label>}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            disabled={disabled}
          >
            <span className="truncate">{displayValue}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <CommandInput placeholder="Search fonts..." />
            <CommandList>
              <CommandEmpty>No font found.</CommandEmpty>

              <CommandGroup heading="System Fonts">
                {FONT_OPTIONS.filter((opt) => opt.category === "system").map((font) => (
                  <CommandItem
                    key={font.value}
                    value={font.value}
                    onSelect={() => handleSelectPreset(font.fontFamily)}
                    style={{ fontFamily: font.fontFamily }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === font.fontFamily ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {font.label}
                  </CommandItem>
                ))}
              </CommandGroup>

              <CommandGroup heading="Sans-Serif">
                {FONT_OPTIONS.filter((opt) => opt.category === "sans-serif").map((font) => (
                  <CommandItem
                    key={font.value}
                    value={font.value}
                    onSelect={() => handleSelectPreset(font.fontFamily)}
                    style={{ fontFamily: font.fontFamily }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === font.fontFamily ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {font.label}
                  </CommandItem>
                ))}
              </CommandGroup>

              <CommandGroup heading="Serif">
                {FONT_OPTIONS.filter((opt) => opt.category === "serif").map((font) => (
                  <CommandItem
                    key={font.value}
                    value={font.value}
                    onSelect={() => handleSelectPreset(font.fontFamily)}
                    style={{ fontFamily: font.fontFamily }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === font.fontFamily ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {font.label}
                  </CommandItem>
                ))}
              </CommandGroup>

              <CommandGroup heading="Monospace">
                {FONT_OPTIONS.filter((opt) => opt.category === "monospace").map((font) => (
                  <CommandItem
                    key={font.value}
                    value={font.value}
                    onSelect={() => handleSelectPreset(font.fontFamily)}
                    style={{ fontFamily: font.fontFamily }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === font.fontFamily ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {font.label}
                  </CommandItem>
                ))}
              </CommandGroup>

              <CommandGroup>
                <CommandItem onSelect={handleSelectCustom}>
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      isCustom ? "opacity-100" : "opacity-0"
                    )}
                  />
                  Custom Font Stack
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {showCustomInput && (
        <Input
          type="text"
          placeholder="Inter, system-ui, sans-serif"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="font-mono text-sm"
        />
      )}
    </div>
  );
}
