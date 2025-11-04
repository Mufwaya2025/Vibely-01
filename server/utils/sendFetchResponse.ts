import type { Response as ExpressResponse } from 'express';

export const sendFetchResponse = async (
  res: ExpressResponse,
  fetchResponse: Response
) => {
  fetchResponse.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'content-length') return;
    res.setHeader(key, value);
  });

  res.status(fetchResponse.status);

  try {
    const arrayBuffer = await fetchResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (buffer.length > 0) {
      res.send(buffer);
    } else {
      res.end();
    }
  } catch (err) {
    res.end();
  }
};
