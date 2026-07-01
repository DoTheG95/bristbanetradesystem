import React from 'react';

export const colors = {
  background: '#141418',
  backgroundHover: '#18182a',

  border: '#23232c',

  primary: '#4f46e5',

  primaryLight: '#818cf8',

  text: '#ececec',

  secondaryText: '#888',

  success: '#4ade80',

  danger: '#ef4444',

  input: '#18181e',
};

export const cardContainer: React.CSSProperties = {
  background: colors.background,
  border: `1px solid ${colors.border}`,
  borderRadius: 14,
  transition: '.18s ease',
};

export const title: React.CSSProperties = {
  fontWeight: 600,
  color: colors.text,
  fontSize: 15,
};

export const subText: React.CSSProperties = {
  fontSize: 12,
  color: colors.secondaryText,
};

export const badge: React.CSSProperties = {
  padding: '3px 8px',
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 600,
  background: '#222235',
  color: colors.primaryLight,
};

export const input: React.CSSProperties = {
  width: '100%',
  padding: '8px',
  borderRadius: 8,
  background: colors.input,
  border: `1px solid ${colors.border}`,
  color: 'white',
  outline: 'none',
};

export const deleteButton: React.CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: 8,
  cursor: 'pointer',
  border: `1px solid ${colors.border}`,
  background: 'transparent',
  color: '#999',
};

export const primaryButton: React.CSSProperties = {
  width: '100%',
  padding: '10px',
  borderRadius: 8,
  cursor: 'pointer',
  background: colors.primary,
  color: 'white',
  border: 'none',
  fontWeight: 600,
};

export const secondaryButton: React.CSSProperties = {
  width: '100%',
  padding: '10px',
  borderRadius: 8,
  cursor: 'pointer',
  background: 'transparent',
  color: colors.primaryLight,
  border: `1px solid ${colors.primary}`,
  fontWeight: 600,
};