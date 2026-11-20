import React from "react";
import * as config from "../config";
import { DifficultyPreset, IDifficultyField } from "../config";
import { IDifficultySettings } from "../types/session";
import {
  computeScoreMultiplier,
  formatScoreMultiplier,
} from "../utils/difficulty";

const PRESET_ORDER: readonly DifficultyPreset[] = [
  config.DIFFICULTY_PRESETS.PEACEFUL,
  config.DIFFICULTY_PRESETS.EASY,
  config.DIFFICULTY_PRESETS.HARD,
  config.DIFFICULTY_PRESETS.NIGHTMARE,
  config.DIFFICULTY_PRESETS.CUSTOM,
];

const BASIC_FIELDS = config.DIFFICULTY_FIELDS.filter((f) => !f.isAdvanced);
const ADVANCED_FIELDS = config.DIFFICULTY_FIELDS.filter((f) => f.isAdvanced);

interface IDifficultyPickerProps {
  preset: DifficultyPreset | null;
  custom: IDifficultySettings;
  onPresetChange: (preset: DifficultyPreset) => void;
  onCustomChange: (custom: IDifficultySettings) => void;
}

function presetScoreMultiplier(
  preset: DifficultyPreset,
  custom: IDifficultySettings,
): number {
  return computeScoreMultiplier(
    preset === config.DIFFICULTY_PRESETS.CUSTOM
      ? custom
      : config.DIFFICULTY_PRESET_SETTINGS[preset],
  );
}

export const DifficultyPicker: React.FC<IDifficultyPickerProps> = ({
  preset,
  custom,
  onPresetChange,
  onCustomChange,
}) => {
  const renderField = (field: IDifficultyField) => {
    const value = custom[field.key];
    const id = `difficulty-${field.key}`;
    return (
      <div className="difficulty-field" key={field.key}>
        <label htmlFor={id}>{field.label}</label>
        <input
          id={id}
          type="range"
          min={field.min}
          max={field.max}
          step={field.step}
          value={value}
          onChange={(e) =>
            onCustomChange({ ...custom, [field.key]: Number(e.target.value) })
          }
        />
        <span className="difficulty-field-value">
          {field.isPercent ? `${value}%` : value}
        </span>
      </div>
    );
  };

  return (
    <div className="difficulty-picker">
      <div className="difficulty-label" id="difficulty-label">
        Difficulty
      </div>
      <div
        className="difficulty-options"
        role="radiogroup"
        aria-labelledby="difficulty-label"
      >
        {PRESET_ORDER.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={option === preset}
            className={`difficulty-option difficulty-${option}${option === preset ? " selected" : ""}`}
            onClick={() => onPresetChange(option)}
          >
            <span className="difficulty-option-header">
              <span className="difficulty-option-name">
                {config.DIFFICULTY_LABELS[option]}
              </span>
              <span className="difficulty-option-score">
                Score{" "}
                {formatScoreMultiplier(presetScoreMultiplier(option, custom))}
              </span>
            </span>
            <span className="difficulty-option-description">
              {config.DIFFICULTY_DESCRIPTIONS[option]}
            </span>
          </button>
        ))}
      </div>

      {preset === config.DIFFICULTY_PRESETS.CUSTOM && (
        <div className="difficulty-custom">
          <p className="difficulty-custom-hint">100% is the same as Hard.</p>
          {BASIC_FIELDS.map(renderField)}
          <details className="difficulty-advanced">
            <summary>Advanced</summary>
            {ADVANCED_FIELDS.map(renderField)}
          </details>
        </div>
      )}
    </div>
  );
};
