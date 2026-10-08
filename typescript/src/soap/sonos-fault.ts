import { SONOS_NAMESPACE } from '../config/constants';

export interface SoapFaultBody {
  faultcode: string;
  faultstring: string;
  detail?: { $xml: string };
  statusCode: number;
}

export class SonosFault extends Error {
  constructor(
    readonly code: string,
    readonly detailXml?: string,
  ) {
    super(code);
  }

  get Fault(): SoapFaultBody {
    return {
      faultcode: this.code,
      faultstring: this.code,
      ...(this.detailXml ? { detail: { $xml: this.detailXml } } : {}),
      statusCode: 500,
    };
  }

  static withSonosError(faultCode: string, exceptionInfo: string, sonosError: number): SonosFault {
    return new SonosFault(
      faultCode,
      `<ns:ExceptionInfo xmlns:ns="${SONOS_NAMESPACE}">${escapeXml(exceptionInfo)}</ns:ExceptionInfo>` +
        `<ns:SonosError xmlns:ns="${SONOS_NAMESPACE}">${sonosError}</ns:SonosError>`,
    );
  }

  static withRefreshedToken(faultCode: string, authToken: string, privateKey: string): SonosFault {
    return new SonosFault(
      faultCode,
      `<ns:refreshAuthTokenResult xmlns:ns="${SONOS_NAMESPACE}">` +
        `<ns:authToken>${escapeXml(authToken)}</ns:authToken>` +
        `<ns:privateKey>${escapeXml(privateKey)}</ns:privateKey>` +
        `</ns:refreshAuthTokenResult>`,
    );
  }
}

export function escapeXml(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
