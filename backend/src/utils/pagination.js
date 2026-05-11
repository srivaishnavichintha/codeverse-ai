const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = parseInt(process.env.DEFAULT_PAGE_SIZE || '20');
const MAX_LIMIT     = parseInt(process.env.MAX_PAGE_SIZE     || '100');

function parsePagination(query) {
  const page  = Math.max(1, parseInt(query.page  || DEFAULT_PAGE));
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(query.limit || DEFAULT_LIMIT)));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

function paginatedResponse(res, { data, total, page, limit }) {
  const totalPages = Math.ceil(total / limit);
  res.json({
    success: true,
    data,
    pagination: { total, page, limit, totalPages, hasNext: page < totalPages },
  });
}

function successResponse(res, data, statusCode = 200) {
  res.status(statusCode).json({ success: true, data });
}

module.exports = { parsePagination, paginatedResponse, successResponse };
