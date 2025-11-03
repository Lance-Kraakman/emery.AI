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

const FONT_OPTIONS: FontOption[] = [
  {
    value: "system-default",
    label: "System Default",
    fontFamily: "system-ui, -apple-system, sans-serif",
    category: "system",
  },
  {
    value: "system-ui",
    label: "System UI",
    fontFamily: "system-ui, sans-serif",
    category: "system",
  },
  {
    value: "inter",
    label: "Inter",
    fontFamily: "Inter, system-ui, sans-serif",
    category: "sans-serif",
  },
  {
    value: "roboto",
    label: "Roboto",
    fontFamily: "Roboto, system-ui, sans-serif",
    category: "sans-serif",
  },
  {
    value: "open-sans",
    label: "Open Sans",
    fontFamily: "'Open Sans', system-ui, sans-serif",
    category: "sans-serif",
  },
  {
    value: "lato",
    label: "Lato",
    fontFamily: "Lato, system-ui, sans-serif",
    category: "sans-serif",
  },
  {
    value: "poppins",
    label: "Poppins",
    fontFamily: "Poppins, system-ui, sans-serif",
    category: "sans-serif",
  },
  {
    value: "montserrat",
    label: "Montserrat",
    fontFamily: "Montserrat, system-ui, sans-serif",
    category: "sans-serif",
  },
  {
    value: "playfair",
    label: "Playfair Display",
    fontFamily: "'Playfair Display', serif",
    category: "serif",
  },
  {
    value: "merriweather",
    label: "Merriweather",
    fontFamily: "Merriweather, serif",
    category: "serif",
  },
  {
    value: "lora",
    label: "Lora",
    fontFamily: "Lora, serif",
    category: "serif",
  },
  {
    value: "fira-code",
    label: "Fira Code",
    fontFamily: "'Fira Code', monospace",
    category: "monospace",
  },
  {
    value: "jetbrains-mono",
    label: "JetBrains Mono",
    fontFamily: "'JetBrains Mono', monospace",
    category: "monospace",
  },
  {
    value: "source-code-pro",
    label: "Source Code Pro",
    fontFamily: "'Source Code Pro', monospace",
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
