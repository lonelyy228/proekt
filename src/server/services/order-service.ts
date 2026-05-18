import { orderRepository } from "@/server/repositories/order-repository";
import { OrderStatus } from "@prisma/client";
import { AppError } from "@/server/utils/errors";

export const orderService = {
  listForUser: (userId: string) => orderRepository.listUserOrders(userId),

  listForUserPaginated: async (params: {
    userId: string;
    page: number;
    pageSize: number;
    status?: OrderStatus;
  }) => {
    const skip = (params.page - 1) * params.pageSize;
    const [items, total] = await Promise.all([
      orderRepository.listUserOrdersPaginated({
        userId: params.userId,
        skip,
        take: params.pageSize,
        status: params.status
      }),
      orderRepository.countUserOrders({
        userId: params.userId,
        status: params.status
      })
    ]);

    return {
      items,
      page: params.page,
      pageSize: params.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / params.pageSize))
    };
  },

  getUserOrderStatus: async (userId: string, orderId: string) => {
    const order = await orderRepository.findUserOrderById({ userId, orderId });
    if (!order) {
      throw new AppError("NOT_FOUND", "Заказ не найден");
    }

    return {
      id: order.id,
      status: order.status,
      totalCents: order.totalCents,
      currency: order.currency,
      createdAt: order.createdAt
    };
  }
};
