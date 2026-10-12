/**
 * NOX inventory lab — in-memory order + ticket rows.
 * Not Postgres. The ticket row minted here is the ticket; a client id is not.
 */
function fail(code) {
  return Object.assign(new Error(code), { code });
}

function snapshot(order, replayed) {
  return {
    id: order.id,
    status: order.status,
    reason: order.reason,
    ticketIds: [...order.ticketIds],
    replayed,
  };
}

export function createInventoryLab() {
  const types = new Map();
  const orders = new Map();
  const ordersByKey = new Map();
  const tickets = new Map();
  let seq = 0;

  function nextId(prefix) {
    seq += 1;
    return `${prefix}_${seq}`;
  }

  function publicType(type) {
    return {
      id: type.id,
      name: type.name,
      capacity: type.capacity,
      sold: type.sold,
      status: type.status,
      price: type.price,
    };
  }

  return {
    createTicketType({ name, capacity, price = 0 }) {
      if (!Number.isInteger(capacity) || capacity < 1) throw fail("invalid_capacity");
      const type = {
        id: nextId("tt"),
        name: name || "General",
        capacity,
        price,
        sold: 0,
        status: "active",
      };
      types.set(type.id, type);
      return publicType(type);
    },

    deleteTicketType(id) {
      const type = types.get(id);
      if (!type) throw fail("not_found");
      type.status = "deleted";
      return publicType(type);
    },

    createOrder({ idempotencyKey, lines = [], clientTicketIds = [] }) {
      void clientTicketIds;
      if (!idempotencyKey) throw fail("missing_idempotency_key");
      const priorId = ordersByKey.get(idempotencyKey);
      if (priorId) return snapshot(orders.get(priorId), true);

      const order = {
        id: nextId("ord"),
        idempotencyKey,
        status: "rejected",
        reason: null,
        ticketIds: [],
      };

      const need = new Map();
      try {
        if (!Array.isArray(lines) || lines.length === 0) throw fail("empty_order");
        for (const line of lines) {
          const qty = line?.qty;
          if (!Number.isInteger(qty) || qty < 1) throw fail("invalid_qty");
          const type = types.get(line.ticketTypeId);
          if (!type) throw fail("unknown_ticket_type");
          if (type.status !== "active") throw fail("ticket_type_deleted");
          need.set(type.id, (need.get(type.id) || 0) + qty);
        }
        for (const [typeId, qty] of need) {
          const type = types.get(typeId);
          if (type.sold + qty > type.capacity) throw fail("oversell");
        }
      } catch (err) {
        order.reason = err.code || "rejected";
        orders.set(order.id, order);
        ordersByKey.set(idempotencyKey, order.id);
        return snapshot(order, false);
      }

      for (const [typeId, qty] of need) {
        const type = types.get(typeId);
        for (let i = 0; i < qty; i += 1) {
          const ticket = {
            id: nextId("tkt"),
            orderId: order.id,
            ticketTypeId: typeId,
            status: "issued",
          };
          tickets.set(ticket.id, ticket);
          order.ticketIds.push(ticket.id);
        }
        type.sold += qty;
      }
      order.status = "confirmed";
      orders.set(order.id, order);
      ordersByKey.set(idempotencyKey, order.id);
      return snapshot(order, false);
    },

    getType(id) {
      const type = types.get(id);
      if (!type) throw fail("not_found");
      return publicType(type);
    },

    ticketsForType(ticketTypeId) {
      return [...tickets.values()]
        .filter((ticket) => ticket.ticketTypeId === ticketTypeId)
        .map((ticket) => ({
          id: ticket.id,
          orderId: ticket.orderId,
          ticketTypeId: ticket.ticketTypeId,
          status: ticket.status,
        }));
    },
  };
}
