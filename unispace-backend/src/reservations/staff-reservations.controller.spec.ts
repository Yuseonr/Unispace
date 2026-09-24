import { jest } from '@jest/globals';
import { Test, type TestingModule } from '@nestjs/testing';
import { StaffReservationsController } from './staff-reservations.controller';
import { ReservationsService } from './reservations.service';
import { ReservationStatus, UserRole } from '../generated/prisma/client';
import type { AuthenticatedUser } from '../accounts/auth/auth.types';


describe('StaffReservationsController', () => {
  let controller: StaffReservationsController;
  let service: ReservationsService;

  const mockStaffUser: AuthenticatedUser = {
    id: 'staff-uuid-001',
    email: 'staff@unispace.test',
    role: UserRole.STAFF,
  };

  const mockService = {
    listStaff: jest.fn(),
    getStaffDetail: jest.fn(),
    approve: jest.fn(),
    reject: jest.fn(),
    cancelByStaff: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StaffReservationsController],
      providers: [
        {
          provide: ReservationsService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<StaffReservationsController>(
      StaffReservationsController,
    );
    service = module.get<ReservationsService>(ReservationsService);
    jest.clearAllMocks();
  });

  it('memanggil reservationsService.listStaff dengan parameter query yang diberikan', async () => {
    const query = {
      status: ReservationStatus.PENDING,
      page: 1,
      limit: 10,
    };
    mockService.listStaff.mockResolvedValue({ data: [], meta: {} });

    const result = await controller.list(query);

    expect(service.listStaff).toHaveBeenCalledWith(query);
    expect(result).toEqual({ data: [], meta: {} });
  });

  it('memanggil reservationsService.getStaffDetail dengan id yang diberikan', async () => {
    const reservationId = '70000000-0000-4000-8000-000000000001';
    mockService.getStaffDetail.mockResolvedValue({ id: reservationId });

    const result = await controller.getDetail(reservationId);

    expect(service.getStaffDetail).toHaveBeenCalledWith(reservationId);
    expect(result).toEqual({ id: reservationId });
  });

  it('memanggil reservationsService.approve dengan user.id, id reservasi, dan DTO', async () => {
    const reservationId = '70000000-0000-4000-8000-000000000001';
    const dto = { allocatedAssetIds: ['unit-uuid-1'] };
    mockService.approve.mockResolvedValue({
      id: reservationId,
      status: ReservationStatus.APPROVED,
    });

    const result = await controller.approve(mockStaffUser, reservationId, dto);

    expect(service.approve).toHaveBeenCalledWith(
      mockStaffUser.id,
      reservationId,
      dto,
    );
    expect(result.status).toBe(ReservationStatus.APPROVED);
  });

  it('memanggil reservationsService.reject dengan user.id, id reservasi, dan DTO alasan penolakan', async () => {
    const reservationId = '70000000-0000-4000-8000-000000000001';
    const dto = { reason: 'Ruangan sedang dalam renovasi darurat.' };
    mockService.reject.mockResolvedValue({
      id: reservationId,
      status: ReservationStatus.REJECTED,
    });

    const result = await controller.reject(mockStaffUser, reservationId, dto);

    expect(service.reject).toHaveBeenCalledWith(
      mockStaffUser.id,
      reservationId,
      dto,
    );
    expect(result.status).toBe(ReservationStatus.REJECTED);
  });

  it('memanggil reservationsService.cancelByStaff dengan user.id, id reservasi, dan DTO alasan pembatalan', async () => {
    const reservationId = '70000000-0000-4000-8000-000000000001';
    const dto = { reason: 'Agenda kunjungan pimpinan universitas.' };
    mockService.cancelByStaff.mockResolvedValue({
      id: reservationId,
      status: ReservationStatus.CANCELLED_BY_STAFF,
    });

    const result = await controller.cancel(mockStaffUser, reservationId, dto);

    expect(service.cancelByStaff).toHaveBeenCalledWith(
      mockStaffUser.id,
      reservationId,
      dto,
    );
    expect(result.status).toBe(ReservationStatus.CANCELLED_BY_STAFF);
  });
});
