// services/favoriteService.ts

const FAVORITES_KEY = 'vibely_favorites';

export const getFavoriteEvents = (): Set<string> => {
  try {
    const favoritesJson = localStorage.getItem(FAVORITES_KEY);
    const favoriteIds = favoritesJson ? JSON.parse(favoritesJson) : [];
    return new Set(favoriteIds);
  } catch (error) {
    console.error("Failed to parse favorites", error);
    return new Set();
  }
};

export const addFavoriteEvent = (eventId: string): void => {
  const favorites = getFavoriteEvents();
  favorites.add(eventId);
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(Array.from(favorites)));
};

export const removeFavoriteEvent = (eventId: string): void => {
  const favorites = getFavoriteEvents();
  favorites.delete(eventId);
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(Array.from(favorites)));
};
