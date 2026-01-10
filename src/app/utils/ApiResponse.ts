export class ApiResponse {
  static success(message: string, data?: any, status: number = 200) {
    const responseBody: { success: boolean; message: string; data?: any } = {
      success: true,
      message,
    };

    if (data !== null && data !== undefined) {
      responseBody.data = data;
    }

    return Response.json(responseBody, { status });
  }

  static error(message: string, status: number) {
    return Response.json(
      {
        success: false,
        message,
      },
      {
        status,
      }
    );
  }
}
