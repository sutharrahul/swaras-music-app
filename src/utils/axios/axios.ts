import Axios, { AxiosError, AxiosResponse } from 'axios';
import chalk from 'chalk';

const axiosInstance = Axios.create({
  // baseURL: process.env.NEXT_PUBLIC_BASE_URL,
  timeout: 1000 * 60,
});

const successHandler = (response: AxiosResponse) => {
  const config = response?.config;
  const method = chalk.green(chalk.bold(config.method?.toUpperCase()));
  const url = chalk.green(chalk.italic(config.baseURL?.toLowerCase(), config.url));
  const status = chalk.bgGreen(chalk.bold(response?.status));
  const data = JSON.stringify(response?.data, null, 4);
  let timeTaken = Infinity;
  // @ts-expect-error - metadata is a custom property added to axios config for logging
  const metadata = config?.metadata;
  if (metadata?.startTime) {
    timeTaken = (+new Date() - metadata?.startTime) / 1000;
  }

  console.log(
    `[Axios-successHandler] [${Number(timeTaken).toFixed(2)}s] [${new Date().toLocaleString()}] [${status}] [${method}: ${url}] \ndata:${data}`
  );
  return response;
};

const errorHandler = async (error: AxiosError): Promise<AxiosError> => {
  const response = error?.response;
  const config = error?.response?.config;
  const method = chalk.green(chalk.bold(config?.method?.toUpperCase()));
  const url = chalk.green(chalk.italic(config?.baseURL?.toLowerCase(), config?.url));
  const status = chalk.bgGreen(chalk.bold(response?.status));
  const data = JSON.stringify(response?.data, null, 4);

  let timeTaken = Infinity;
  // @ts-expect-error - metadata is a custom property added to axios config for logging
  const metadata = config?.metadata;
  if (metadata?.startTime) {
    timeTaken = (+new Date() - metadata?.startTime) / 1000;
  }

  console.log(
    chalk.red(
      `[Axios-errorHandler] [${timeTaken}] [${status}] [${method}: ${url}] \nerror_message:${error?.message}\n\ndata:${data}`
    )
  );
  return Promise.reject(error);
};

const requestHandler = (config: any) => {
  config.metadata = { startTime: new Date() };

  const method = chalk.green(chalk.bold(config.method?.toUpperCase()));
  const url = chalk.green(chalk.italic(config.baseURL?.toLowerCase(), config.url));
  const data = JSON.stringify(config?.data, null, 4);
  const params = JSON.stringify(config?.params, null, 4);
  const headers = JSON.stringify(config?.headers, null, 4);
  const baseUrl = chalk.green(chalk.italic(config.baseURL?.toLowerCase()));

  console.log(
    `[Axios-requestHandler] [${method}: ${baseUrl} ${url}] \ndata:${data}\nparams:${params}\nheaders:${headers}`
  );

  return config;
};

axiosInstance.interceptors.response.use(
  (response: AxiosResponse) => successHandler(response),
  (error: AxiosError) => errorHandler(error)
);

axiosInstance.interceptors.request.use(
  (config: any) => requestHandler(config),
  error => Promise.reject(error)
);

export { axiosInstance };
