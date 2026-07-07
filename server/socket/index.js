/**
 * Socket.IO setup — Multi-tenant isolated rooms.
 * Every socket is placed into a room named after its tenant slug.
 * Events are then emitted to that specific room only, ensuring
 * Cafe 1 and Cafe 2 never receive each other's real-time updates.
 */
function setupSocket(io) {
  io.on('connection', (socket) => {
    // Pull tenant slug sent by the client during handshake
    const tenantSlug = socket.handshake.auth?.tenantSlug || 'demo';
    const tenantRoom = `tenant_${tenantSlug}`;

    // Immediately join the tenant-specific room
    socket.join(tenantRoom);
    console.log(`Client connected: ${socket.id} → room: ${tenantRoom}`);

    socket.on('join_kitchen', () => {
      socket.join(`kitchen_${tenantSlug}`);
      console.log(`Kitchen client joined room: kitchen_${tenantSlug}`);
    });

    socket.on('join_pos', () => {
      socket.join(`pos_${tenantSlug}`);
    });

    socket.on('kot_item_update', (data) => {
      io.to(tenantRoom).emit('kot_updated', data);
    });

    socket.on('order_ready', (data) => {
      io.to(tenantRoom).emit('order_ready_notify', data);
    });

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id} (${tenantRoom})`);
    });
  });
}

module.exports = { setupSocket };
