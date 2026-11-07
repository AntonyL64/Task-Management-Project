import apiClient, { ensureArray } from './apiClient';
import type { RequestOptions } from './apiClient';
import type { TaskInput } from '../types/domain';
import type { CreateTaskDto, UpdateTaskDto } from '../types/api';

/**
 * Tasks (Member A's NestJS module).
 *
 * Every route below is relative to the client's base URL, which already ends in
 * `/api`: `getTasks` calls `GET {VITE_API_URL}/tasks`, i.e. `GET /api/tasks`.
 * All methods need a logged-in user (JWT) and reject with `ApiError`.
 */
export const taskService = {
  /**
   * Lists the current user's tasks.
   *
   * `GET /api/tasks`
   *
   * @param options.signal Aborts the request.
   * @returns The tasks, as the scheduling core sees them (`TaskInput`).
   * @throws {ApiError} 401 not logged in; `kind: 'invalid-response'` if the body is not a list.
   */
  async getTasks(options?: RequestOptions): Promise<TaskInput[]> {
    const { data } = await apiClient.get<unknown>('/tasks', { signal: options?.signal });
    return ensureArray<TaskInput>(data, 'GET /api/tasks');
  },

  /**
   * Creates a task. The server assigns `id` and `createdAt`.
   *
   * `POST /api/tasks`
   *
   * @param data The new task. See `CreateTaskDto` for the required fields.
   * @param options.signal Aborts the request.
   * @returns The stored task, including its generated `id`.
   * @throws {ApiError} 400/422 invalid data (`details` lists each problem, e.g. an unknown
   *         `dependencyIds` entry or a dependency cycle); 401 not logged in.
   */
  async createTask(data: CreateTaskDto, options?: RequestOptions): Promise<TaskInput> {
    const response = await apiClient.post<TaskInput>('/tasks', data, { signal: options?.signal });
    return response.data;
  },

  /**
   * Updates part of a task. Only the fields present in `data` change.
   * The server sets `remainingMinutes` to 0 when a task becomes DONE.
   *
   * `PATCH /api/tasks/:id`
   *
   * @param id Id of the task to change.
   * @param data The fields to change (`id` and `createdAt` cannot be changed).
   * @param options.signal Aborts the request.
   * @returns The task after the update (use it, since the server may adjust other fields).
   * @throws {ApiError} 400/422 invalid data; 401 not logged in; 404 no such task.
   */
  async updateTask(id: string, data: UpdateTaskDto, options?: RequestOptions): Promise<TaskInput> {
    const response = await apiClient.patch<TaskInput>(`/tasks/${encodeURIComponent(id)}`, data, {
      signal: options?.signal,
    });
    return response.data;
  },

  /**
   * Deletes a task.
   *
   * `DELETE /api/tasks/:id`
   *
   * @param id Id of the task to delete.
   * @param options.signal Aborts the request.
   * @returns Nothing. Whether the server also cleans up dependencies that point at the
   *          task (and its sessions) is the backend's call; reload the list afterwards.
   * @throws {ApiError} 401 not logged in; 404 no such task.
   */
  async deleteTask(id: string, options?: RequestOptions): Promise<void> {
    await apiClient.delete(`/tasks/${encodeURIComponent(id)}`, { signal: options?.signal });
  },
};
