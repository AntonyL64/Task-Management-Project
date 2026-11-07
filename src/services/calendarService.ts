import apiClient, { ensureArray } from './apiClient';
import type { RequestOptions } from './apiClient';
import type { CalendarEvent } from '../types/domain';
import type { CreateCalendarEventDto, WorkingHours } from '../types/api';

/**
 * Calendar events and working hours (Member A's NestJS module).
 *
 * Routes are relative to the client's base URL, which already ends in `/api`.
 * All timestamps are ISO-8601 UTC strings ("…Z"). All methods need a logged-in
 * user (JWT) and reject with `ApiError`.
 */
export const calendarService = {
  /**
   * Lists the user's fixed events (meetings, imported Google / ICS entries).
   * The scheduler plans work around them.
   *
   * `GET /api/calendar/events`
   *
   * @param options.signal Aborts the request.
   * @returns All of the user's events.
   * @throws {ApiError} 401 not logged in; `kind: 'invalid-response'` if the body is not a list.
   */
  async getEvents(options?: RequestOptions): Promise<CalendarEvent[]> {
    const { data } = await apiClient.get<unknown>('/calendar/events', { signal: options?.signal });
    return ensureArray<CalendarEvent>(data, 'GET /api/calendar/events');
  },

  /**
   * Creates a fixed event.
   *
   * `POST /api/calendar/events`
   *
   * @param data `title`, `startAt` and `endAt` are required; `source` is optional.
   * @param options.signal Aborts the request.
   * @returns The stored event, including its generated `id`.
   * @throws {ApiError} 400/422 invalid data (e.g. `endAt` not after `startAt`); 401 not logged in.
   */
  async createEvent(data: CreateCalendarEventDto, options?: RequestOptions): Promise<CalendarEvent> {
    const response = await apiClient.post<CalendarEvent>('/calendar/events', data, { signal: options?.signal });
    return response.data;
  },

  /**
   * Gets the user's weekly working hours: one entry per working day.
   *
   * `GET /api/users/working-hours`
   *
   * @param options.signal Aborts the request.
   * @returns The working days (days without an entry are days off).
   * @throws {ApiError} 401 not logged in; `kind: 'invalid-response'` if the body is not a list.
   */
  async getWorkingHours(options?: RequestOptions): Promise<WorkingHours[]> {
    const { data } = await apiClient.get<unknown>('/users/working-hours', { signal: options?.signal });
    return ensureArray<WorkingHours>(data, 'GET /api/users/working-hours');
  },

  /**
   * Replaces the user's weekly working hours (the Settings page's "Save changes").
   * Listed in the Week 8 plan next to the GET; the request body (the full list) is assumed.
   *
   * `PUT /api/users/working-hours`
   *
   * @param hours The complete list of working days after the change.
   * @param options.signal Aborts the request.
   * @returns The stored working hours.
   * @throws {ApiError} 400/422 invalid data (e.g. `endTime` not after `startTime`); 401 not logged in.
   */
  async updateWorkingHours(hours: WorkingHours[], options?: RequestOptions): Promise<WorkingHours[]> {
    const { data } = await apiClient.put<unknown>('/users/working-hours', hours, { signal: options?.signal });
    return ensureArray<WorkingHours>(data, 'PUT /api/users/working-hours');
  },
};
