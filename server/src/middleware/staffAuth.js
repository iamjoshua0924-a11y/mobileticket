const STAFF_ACCESS = {
  '4231': {
    role: 'staff',
    permissions: {
      viewTickets: true,
      createOnsite: true,
      checkin: true,
      payment: false,
      refund: false,
      deleteTicket: false,
      viewDeleted: false,
      restoreDeleted: false,
      exportCsv: false,
      settlement: false
    }
  },
  '0924': {
    role: 'admin',
    permissions: {
      viewTickets: true,
      createOnsite: true,
      checkin: true,
      payment: true,
      refund: true,
      deleteTicket: true,
      viewDeleted: true,
      restoreDeleted: true,
      exportCsv: true,
      settlement: true
    }
  }
};

function resolveStaffAccess(secret) {
  if (!secret) return null;

  if (STAFF_ACCESS[secret]) {
    return { secret, ...STAFF_ACCESS[secret] };
  }

  const fallback = process.env.STAFF_SECRET;
  if (fallback && secret === fallback) {
    return {
      secret,
      role: 'admin',
      permissions: {
        viewTickets: true,
        createOnsite: true,
        checkin: true,
        payment: true,
        refund: true,
        deleteTicket: true,
        viewDeleted: true,
        restoreDeleted: true,
        exportCsv: true,
        settlement: true
      }
    };
  }

  return null;
}

function staffAuth(req, res, next) {
  const got = req.header('x-staff-secret');
  const access = resolveStaffAccess(got);
  if (!access) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  req.staffAccess = access;
  return next();
}

function requireStaffPermission(permission) {
  return function permissionGuard(req, res, next) {
    if (!req.staffAccess?.permissions?.[permission]) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    return next();
  };
}

module.exports = { staffAuth, requireStaffPermission };
