"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RotateCcw } from "lucide-react"
import type { FieldDTO } from "@/app/mappers/field-mapper"
import type { AutonumberFieldConfig } from "@/ddd/domain/tables/value-objects/table-field"
import { resetAutonumberCounter } from "@/app/actions/fields"

interface AutonumberCounterResetProps {
  field: FieldDTO
  tableId: number
}

export function AutonumberCounterReset({ field, tableId }: AutonumberCounterResetProps) {
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [resetValue, setResetValue] = useState<string>("")
  const [loading, setLoading] = useState(false)

  const currentNextValue = ((field.metadata as AutonumberFieldConfig)?.currentValue ??
    (field.metadata as AutonumberFieldConfig)?.startingNumber ?? 0) + 1

  const handleResetCounter = async () => {
    const resetNum = parseInt(resetValue)
    if (isNaN(resetNum) || resetNum < 1) {
      alert("Please enter a valid number greater than 0")
      return
    }

    setLoading(true)
    try {
      const result = await resetAutonumberCounter(tableId, field.name, resetNum)

      if (result.success) {
        setShowResetConfirm(false)
        setResetValue("")
        alert("Counter reset successfully. Refresh to see updated values.")
      } else {
        alert(result.error || "Failed to reset counter")
      }
    } catch (error) {
      console.error("Failed to reset counter:", error)
      alert("Failed to reset counter")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="border-t pt-3 mt-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm">
          <span className="text-muted-foreground">Current next value: </span>
          <span className="font-medium">{currentNextValue}</span>
        </div>
        {!showResetConfirm && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setResetValue(currentNextValue.toString())
              setShowResetConfirm(true)
            }}
            className="text-primary hover:text-primary/80"
          >
            <RotateCcw className="w-3 h-3 mr-1" />
            Reset Counter
          </Button>
        )}
      </div>

      {showResetConfirm && (
        <div className="space-y-3 p-3 bg-amber-50 border border-amber-200 rounded">
          <div className="text-sm text-amber-800">
            <strong>Warning:</strong> This will only affect new rows. Existing row values will not change.
          </div>
          <div className="space-y-2">
            <Label htmlFor="resetValue">New next value</Label>
            <Input
              id="resetValue"
              type="number"
              min="1"
              value={resetValue}
              onChange={(e) => setResetValue(e.target.value)}
              placeholder="Enter new value..."
            />
            <p className="text-xs text-muted-foreground">
              The next row will receive this number
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleResetCounter}
              disabled={loading || !resetValue}
            >
              {loading ? "Resetting..." : "Confirm Reset"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowResetConfirm(false)
                setResetValue("")
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
