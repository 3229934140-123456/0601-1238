function success(res, data = null, message = 'success', code = 200) {
  res.status(code).json({
    code,
    message,
    data,
    timestamp: Date.now()
  });
}

function error(res, message = 'error', code = 500, data = null) {
  res.status(code >= 100 && code < 600 ? code : 500).json({
    code,
    message,
    data,
    timestamp: Date.now()
  });
}

function paginate(list, page = 1, pageSize = 10, total = 0) {
  return {
    list,
    pagination: {
      page: parseInt(page),
      pageSize: parseInt(pageSize),
      total,
      totalPages: Math.ceil(total / pageSize) || 0
    }
  };
}

module.exports = {
  success,
  error,
  paginate
};
