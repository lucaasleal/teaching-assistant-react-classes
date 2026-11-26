/**
 * Type checks for request payloads. Bodies come from untrusted clients, so a
 * field being present says nothing about its type.
 */

export const isString = (value: unknown): value is string => typeof value === 'string';

export const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

export const isInteger = (value: unknown): value is number => Number.isInteger(value);

export const isNonEmptyStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.length > 0 && value.every(isNonEmptyString);