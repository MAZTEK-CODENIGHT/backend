export const globalErrHandler = (err, req, res, next) => {
  // Hatanın bilgilerini al
  const stack = err.stack;
  const message = err.message;
  const status = err.status ? err.status : false;
  const statusCode = err.statusCode ? err.statusCode : 500;

  // Hata mesajını res.locals.errorMessage'e ayarla
  res.locals.errorMessage = message;

  // Hata bilgilerini JSON olarak yanıtla
  res.status(statusCode).json({
    success:status,
    message,
    stack,
  });
};

// Bulunamayan kaynak için hata işleyici
export const notFoundErr = (req, res, next) => {
  const err = new Error(`Can't find ${req.originalUrl} on the server`);
  // Hata nesnesini sonraki işleyiciye ilet
  next(err);
};
